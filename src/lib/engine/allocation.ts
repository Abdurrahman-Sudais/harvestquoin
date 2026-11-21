import { addDays, diffDays } from "../dates";
import type { AppState, Batch, GradeCode, ISODate, Order } from "../types";
import type { QualityForecast } from "./forecast";
import { batchInventory, latestInspection, orderProgress } from "./inventory";
import { gradeMeets, gradeMinScore } from "./quality";

/**
 * Deterministic batch-to-order recommendation engine.
 * Mirrors the logic intended for the AWS Lambda allocation function
 * (see src/lib/aws/lambda.ts) so results are reproducible client- or server-side.
 */

export type Compatibility = "strong" | "good" | "marginal";

export interface Recommendation {
  key: string;
  orderId: string;
  batchId: string;
  qtyKg: number;
  availableKg: number;
  orderRemainingKg: number;
  dispatchDate: ISODate;
  suitability: number;
  compatibility: Compatibility;
  currentGrade: GradeCode;
  predictedScoreAtDelivery: number;
  predictedGradeAtDelivery: GradeCode;
  marginAtDelivery: number;
  daysToAcceptanceLimit: number | null;
  explanation: string[];
}

export interface ExcludedCandidate {
  orderId: string;
  batchId: string;
  reason: string;
}

export interface Shortfall {
  orderId: string;
  shortKg: number;
  reason: string;
}

export interface AllocationPlan {
  recommendations: Recommendation[];
  excluded: ExcludedCandidate[];
  shortfalls: Shortfall[];
}

export function dispatchDateFor(order: Order): ISODate {
  return addDays(order.deliveryDate, -order.transitDays);
}

export function recommendAllocations(state: AppState, forecasts: Map<string, QualityForecast>): AllocationPlan {
  const today = state.today;
  const recs: Recommendation[] = [];
  const excluded: ExcludedCandidate[] = [];
  const shortfalls: Shortfall[] = [];

  // Tentative availability is decremented as recommendations are made so that
  // two orders can never be recommended the same kilograms.
  const tentative = new Map<string, number>();
  for (const b of state.batches) tentative.set(b.id, batchInventory(b, state.inspections, state.allocations).availableKg);

  const orders = state.orders
    .filter((o) => o.manualStatus === "open")
    .map((o) => ({ o, prog: orderProgress(o, state.allocations) }))
    .filter(({ prog }) => prog.remainingKg > 0)
    .sort((a, b) => a.o.deliveryDate.localeCompare(b.o.deliveryDate) || a.o.code.localeCompare(b.o.code));

  for (const { o: order, prog } of orders) {
    const cat = state.categories.find((c) => c.id === order.categoryId);
    if (!cat) continue;
    const dispatchDate = dispatchDateFor(order);
    const daysToDelivery = Math.max(0, diffDays(order.deliveryDate, today));
    const minScore = gradeMinScore(cat, order.acceptedGrade);
    let remaining = prog.remainingKg;

    type Cand = { b: Batch; avail: number; fc: QualityForecast; score: number; margin: number; parts: string[]; s: number };
    const cands: Cand[] = [];

    for (const b of state.batches) {
      if (b.categoryId !== order.categoryId) continue;
      const avail = tentative.get(b.id) ?? 0;
      if (avail <= 0) continue;
      const ex = (reason: string) => excluded.push({ orderId: order.id, batchId: b.id, reason });
      if (b.flag) {
        ex(b.flag === "on_hold" ? "Batch is on hold" : "Batch rejected");
        continue;
      }
      if (state.rejectedRecommendations.some((r) => r.orderId === order.id && r.batchId === b.id)) {
        ex("Previously rejected by a manager for this order");
        continue;
      }
      if (order.variety && b.variety !== order.variety) {
        ex(`Variety ${b.variety} ≠ required ${order.variety}`);
        continue;
      }
      if (b.arrivalDate > dispatchDate) {
        ex("Arrives after the required dispatch date");
        continue;
      }
      const fc = forecasts.get(b.id);
      const insp = latestInspection(b.id, state.inspections);
      if (!fc || !insp) {
        ex("No inspection recorded yet");
        continue;
      }
      const predScore = fc.scoreAt(daysToDelivery);
      const predGrade = fc.gradeAt(daysToDelivery);
      if (!gradeMeets(insp.grade, order.acceptedGrade)) {
        ex(`Current inspection grade ${insp.grade} below accepted grade ${order.acceptedGrade}`);
        continue;
      }
      if (!gradeMeets(predGrade, order.acceptedGrade)) {
        ex(`Predicted grade at delivery ${predGrade} (score ${predScore}) below accepted ${order.acceptedGrade}`);
        continue;
      }
      const damage = insp.values.damage_pct ?? 0;
      const decay = insp.values.decay_pct ?? 0;
      if (damage > order.spec.maxDamagePct) {
        ex(`Damage ${damage}% exceeds buyer limit ${order.spec.maxDamagePct}%`);
        continue;
      }
      if (decay > order.spec.maxDecayPct) {
        ex(`Decay ${decay}% exceeds buyer limit ${order.spec.maxDecayPct}%`);
        continue;
      }
      if (order.spec.minFirmness !== undefined && (insp.values.firmness ?? 0) < order.spec.minFirmness) {
        ex(`Firmness ${insp.values.firmness} below buyer minimum ${order.spec.minFirmness}`);
        continue;
      }
      const ripeAtDelivery = fc.ripenessAt(daysToDelivery);
      if (order.spec.acceptedRipeness.length && !order.spec.acceptedRipeness.includes(ripeAtDelivery)) {
        ex(`Predicted ripeness at delivery "${cat.ripenessStages[ripeAtDelivery]}" not accepted`);
        continue;
      }

      // ---- Suitability scoring (0–100) ----
      const margin = Math.round((predScore - minScore) * 10) / 10;
      const dl = fc.daysToAcceptanceLimit;
      const urgency = dl === null ? 20 : Math.max(0, Math.min(100, 100 - dl * 9));
      const qualityFit = margin <= 12 ? 100 - margin * 1.5 : Math.max(35, 82 - (margin - 12) * 2.5);
      const age = diffDays(today, b.arrivalDate);
      const ageScore = Math.max(0, Math.min(100, age * 12));
      const qtyFit = avail >= remaining ? 100 : Math.round((avail / remaining) * 100);
      const s = Math.round(0.38 * urgency + 0.3 * qualityFit + 0.14 * ageScore + 0.18 * qtyFit);

      const parts: string[] = [];
      parts.push(`Current inspection grade ${insp.grade} (score ${insp.qualityScore}) meets accepted grade ${order.acceptedGrade}.`);
      parts.push(`Simulated forecast: score ${predScore} / grade ${predGrade} on delivery (${daysToDelivery} d), ${margin} pts above the grade ${order.acceptedGrade} minimum.`);
      if (dl !== null && dl <= 4) parts.push(`Reaches its current-grade limit in ~${dl} days — dispatching first reduces quality loss (first-expiring, first-out).`);
      else if (margin > 15) parts.push(`Quality headroom is large; a lower-quality compatible batch would normally be preferred.`);
      parts.push(`Arrived ${age} day${age === 1 ? "" : "s"} ago; damage ${damage}%, decay ${decay}% within buyer limits.`);
      parts.push(avail >= remaining ? `Can cover the full remaining ${remaining.toLocaleString()} kg.` : `Covers ${avail.toLocaleString()} of ${remaining.toLocaleString()} kg remaining.`);

      cands.push({ b, avail, fc, score: predScore, margin, parts, s });
    }

    cands.sort((a, b) => b.s - a.s || a.b.code.localeCompare(b.b.code));
    for (const c of cands) {
      if (remaining <= 0) break;
      const qty = Math.min(c.avail, remaining);
      if (qty <= 0) continue;
      const insp = latestInspection(c.b.id, state.inspections)!;
      recs.push({
        key: `${order.id}:${c.b.id}`,
        orderId: order.id,
        batchId: c.b.id,
        qtyKg: qty,
        availableKg: c.avail,
        orderRemainingKg: remaining,
        dispatchDate,
        suitability: c.s,
        compatibility: c.s >= 72 && c.margin >= 4 ? "strong" : c.margin >= 2 ? "good" : "marginal",
        currentGrade: insp.grade,
        predictedScoreAtDelivery: c.score,
        predictedGradeAtDelivery: c.fc.gradeAt(daysToDelivery),
        marginAtDelivery: c.margin,
        daysToAcceptanceLimit: c.fc.daysToAcceptanceLimit,
        explanation: c.parts,
      });
      tentative.set(c.b.id, c.avail - qty);
      remaining -= qty;
    }
    if (remaining > 0)
      shortfalls.push({
        orderId: order.id,
        shortKg: remaining,
        reason: cands.length === 0 ? "No compatible batches with available inventory" : "Compatible inventory is insufficient",
      });
  }

  return { recommendations: recs, excluded, shortfalls };
}
