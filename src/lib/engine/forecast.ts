import { addDays, diffDays } from "../dates";
import type { Batch, GradeCode, ISODate, Inspection, ProduceCategory, Supplier } from "../types";
import { gradeFromScore } from "./quality";

/**
 * Quality forecasting.
 *
 * IMPORTANT: everything produced here is a SIMULATED ESTIMATE of commercial quality.
 * It is never an inspection result and never a guaranteed shelf-life measurement.
 * The `QualityForecastProvider` interface is the seam where an Amazon SageMaker AI
 * endpoint replaces the simulator (see src/lib/aws/sagemaker.ts).
 */

export interface ForecastInput {
  batch: Batch;
  category: ProduceCategory;
  inspections: Inspection[]; // this batch only, any order
  supplier?: Supplier;
  asOf: ISODate;
}

export interface ForecastPoint {
  date: ISODate;
  day: number;
  score: number;
  lower: number;
  upper: number;
  grade: GradeCode;
}

export interface ForecastDriver {
  label: string;
  factor: number;
  detail: string;
}

export type Trend = "stable" | "gradual_decline" | "rapid_decline";
export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface QualityForecast {
  batchId: string;
  source: "simulated" | "sagemaker";
  modelVersion: string;
  generatedFor: ISODate;
  /** Latest actual inspection (not a prediction). */
  inspection: { date: ISODate; score: number; grade: GradeCode } | null;
  /** Estimated score today, projected from the latest inspection. */
  estimatedScoreToday: number;
  predictedGradeToday: GradeCode;
  /** Predicted grade at the 3-day planning horizon. */
  predictedGrade: GradeCode;
  predictedScore: number;
  horizonDays: number;
  dailyDecay: number;
  trend: Trend;
  curve: ForecastPoint[];
  /** Days from today until estimated score crosses each grade's minimum (null = beyond 21 days). */
  daysToGradeLimit: Record<GradeCode, number | null>;
  /** Days until the batch falls below its current inspection grade. */
  daysToAcceptanceLimit: number | null;
  acceptanceRisk: RiskLevel;
  confidence: { pct: number; level: "High" | "Medium" | "Low"; reasons: string[] };
  recommendedReviewDate: ISODate;
  drivers: ForecastDriver[];
  scoreAt: (daysFromToday: number) => number;
  gradeAt: (daysFromToday: number) => GradeCode;
  ripenessAt: (daysFromToday: number) => number;
}

export interface QualityForecastProvider {
  readonly id: string;
  readonly label: string;
  readonly simulated: boolean;
  forecast(input: ForecastInput): QualityForecast | null;
}

const PACKAGING_FACTOR: Record<Batch["handling"]["packaging"], number> = {
  ventilated_crates: 1.0,
  plastic_crates: 1.06,
  raffia_baskets: 1.35,
  bulk_sacks: 1.6,
};
const TRANSPORT_FACTOR: Record<Batch["handling"]["transport"], number> = {
  reefer_truck: 0.92,
  covered_truck: 1.05,
  open_truck: 1.2,
};
export const STORAGE_DEFAULT_TEMP: Record<Batch["handling"]["storageType"], number> = {
  cold_room: 13,
  evaporative_cooler: 21,
  ambient_shaded: 29,
};
const RIPENESS_FACTOR = [0.7, 0.8, 0.95, 1.1, 1.25, 1.45];
const ACCEL = 0.025; // deterioration accelerates slightly with time in storage

const round1 = (n: number) => Math.round(n * 10) / 10;

export function averageStorageTemp(batch: Batch, asOf: ISODate): { temp: number; fromLogs: boolean } {
  const recent = batch.temperatureLog.filter((r) => diffDays(asOf, r.date) <= 3 && r.date <= asOf);
  if (recent.length === 0) return { temp: STORAGE_DEFAULT_TEMP[batch.handling.storageType], fromLogs: false };
  return { temp: round1(recent.reduce((s, r) => s + r.tempC, 0) / recent.length), fromLogs: true };
}

/** Solve d·t·(1 + ACCEL·t) = delta for t ≥ 0. */
function daysToDrop(delta: number, d: number): number {
  if (delta <= 0) return 0;
  if (d <= 0) return Infinity;
  const a = ACCEL * d;
  return (-d + Math.sqrt(d * d + 4 * a * delta)) / (2 * a);
}

export class SimulatedForecastProvider implements QualityForecastProvider {
  readonly id = "simulated-v1";
  readonly label = "HarvestQuoin simulated model v1.3";
  readonly simulated = true;

  forecast({ batch, category, inspections, supplier, asOf }: ForecastInput): QualityForecast | null {
    const mine = inspections.filter((i) => i.batchId === batch.id && i.date <= asOf).sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
    const latest = mine[mine.length - 1];
    if (!latest) return null;

    // ---- Deterioration drivers -------------------------------------------------
    const drivers: ForecastDriver[] = [];
    const { temp, fromLogs } = averageStorageTemp(batch, asOf);
    const [optLo, optHi] = category.optimalTempC;
    let tempF = 1;
    if (temp > optHi) tempF = Math.pow(1.8, (temp - optHi) / 10);
    else if (temp < category.chillingThresholdC) tempF = 1.3;
    drivers.push({
      label: "Storage temperature",
      factor: round1(tempF * 100) / 100,
      detail: `${temp}°C ${fromLogs ? "(3-day logger average)" : "(storage-type default, no logs)"} vs optimal ${optLo}–${optHi}°C`,
    });

    const packF = PACKAGING_FACTOR[batch.handling.packaging];
    drivers.push({ label: "Packaging", factor: packF, detail: batch.handling.packaging.replace(/_/g, " ") });

    let transF = TRANSPORT_FACTOR[batch.handling.transport];
    if (batch.handling.transitHours > 24) transF += 0.1;
    if (batch.handling.precooled) transF *= 0.9;
    transF = Math.round(transF * 100) / 100;
    drivers.push({
      label: "Transport & pre-cooling",
      factor: transF,
      detail: `${batch.handling.transport.replace(/_/g, " ")}, ${batch.handling.transitHours} h transit${batch.handling.precooled ? ", pre-cooled" : ""}`,
    });

    const ripF = RIPENESS_FACTOR[Math.max(0, Math.min(RIPENESS_FACTOR.length - 1, latest.ripenessStage))];
    drivers.push({ label: "Ripeness at inspection", factor: ripF, detail: category.ripenessStages[latest.ripenessStage] ?? `Stage ${latest.ripenessStage}` });

    const damage = latest.values.damage_pct ?? 0;
    const dmgF = Math.round((1 + damage / 25) * 100) / 100;
    drivers.push({ label: "Mechanical damage", factor: dmgF, detail: `${damage}% of sample damaged` });

    const supF = supplier?.historicalDecayFactor ?? 1;
    drivers.push({ label: "Supplier history", factor: supF, detail: supplier ? `${supplier.batchesDelivered} past batches, ${Math.round(supplier.historicalAcceptRate * 100)}% accepted` : "No history" });

    const age = diffDays(asOf, batch.arrivalDate);
    const ageF = age > 7 ? 1 + (age - 7) * 0.03 : 1;
    if (ageF > 1) drivers.push({ label: "Time since arrival", factor: Math.round(ageF * 100) / 100, detail: `${age} days in storage` });

    const dailyDecay = round1(category.baseDecayPerDay * tempF * packF * transF * ripF * dmgF * supF * ageF);

    // ---- Projection --------------------------------------------------------------
    const sinceInspection = Math.max(0, diffDays(asOf, latest.date));
    const projectFromInspection = (t: number) => latest.qualityScore - dailyDecay * t * (1 + ACCEL * t);
    const estimatedScoreToday = round1(Math.max(0, projectFromInspection(sinceInspection)));
    const scoreAt = (d: number) => round1(Math.max(0, Math.min(100, projectFromInspection(sinceInspection + Math.max(0, d)))));
    const gradeAt = (d: number) => gradeFromScore(category, scoreAt(d));
    const ripenRate = temp <= optHi ? 0.25 : temp <= 24 ? 0.4 : 0.55;
    const ripenessAt = (d: number) =>
      Math.min(category.ripenessStages.length - 1, latest.ripenessStage + Math.floor((sinceInspection + Math.max(0, d)) * ripenRate));

    // ---- Confidence -------------------------------------------------------------
    const reasons: string[] = [];
    let conf = 55;
    if (mine.length >= 2) {
      conf += Math.min(20, (mine.length - 1) * 10);
      reasons.push(`${mine.length} inspections establish an observed trend`);
    } else reasons.push("Single inspection — trend not yet observed");
    if (fromLogs) {
      conf += 10;
      reasons.push("Temperature logger data available");
    } else {
      conf -= 5;
      reasons.push("No recent temperature records — default assumed");
    }
    if (sinceInspection <= 2) {
      conf += 8;
      reasons.push("Inspection is recent");
    } else if (sinceInspection > 5) {
      conf -= 15;
      reasons.push(`Last inspection was ${sinceInspection} days ago`);
    }
    if (supplier && supplier.batchesDelivered >= 10) {
      conf += 5;
      reasons.push("Supplier has substantial batch history");
    }
    conf = Math.max(35, Math.min(92, conf));
    const level: "High" | "Medium" | "Low" = conf >= 75 ? "High" : conf >= 58 ? "Medium" : "Low";

    const horizonDays = 7;
    const curve: ForecastPoint[] = [];
    for (let d = 0; d <= horizonDays; d++) {
      const s = scoreAt(d);
      const spread = (2 + 0.9 * (sinceInspection + d)) * (1.6 - conf / 100);
      curve.push({ date: addDays(asOf, d), day: d, score: s, lower: round1(Math.max(0, s - spread)), upper: round1(Math.min(100, s + spread)), grade: gradeFromScore(category, s) });
    }

    const daysToGradeLimit = {} as Record<GradeCode, number | null>;
    for (const g of category.grades) {
      const t = daysToDrop(estimatedScoreToday - g.minScore, dailyDecay * (1 + 2 * ACCEL * sinceInspection));
      daysToGradeLimit[g.code] = estimatedScoreToday < g.minScore ? 0 : t > 21 ? null : Math.floor(t * 10) / 10;
    }
    daysToGradeLimit.R = null;

    const currentGrade = latest.grade;
    const daysToAcceptanceLimit = currentGrade === "R" ? 0 : daysToGradeLimit[currentGrade];
    const acceptanceRisk: RiskLevel =
      daysToAcceptanceLimit === null ? "low" : daysToAcceptanceLimit <= 1 ? "critical" : daysToAcceptanceLimit <= 3 ? "high" : daysToAcceptanceLimit <= 6 ? "moderate" : "low";

    let reviewIn = daysToAcceptanceLimit === null ? 5 : Math.floor(daysToAcceptanceLimit * 0.5);
    if (level === "Low") reviewIn = Math.min(reviewIn, 2);
    reviewIn = Math.max(acceptanceRisk === "critical" ? 0 : 1, Math.min(5, reviewIn));

    const trend: Trend = dailyDecay < 1.8 ? "stable" : dailyDecay < 3.5 ? "gradual_decline" : "rapid_decline";
    const planning = 3;

    return {
      batchId: batch.id,
      source: "simulated",
      modelVersion: "sim-1.3.0",
      generatedFor: asOf,
      inspection: { date: latest.date, score: latest.qualityScore, grade: latest.grade },
      estimatedScoreToday,
      predictedGradeToday: gradeFromScore(category, estimatedScoreToday),
      predictedScore: scoreAt(planning),
      predictedGrade: gradeAt(planning),
      horizonDays: planning,
      dailyDecay,
      trend,
      curve,
      daysToGradeLimit,
      daysToAcceptanceLimit,
      acceptanceRisk,
      confidence: { pct: conf, level, reasons },
      recommendedReviewDate: addDays(asOf, reviewIn),
      drivers,
      scoreAt,
      gradeAt,
      ripenessAt,
    };
  }
}

export const forecastProvider: QualityForecastProvider = new SimulatedForecastProvider();
