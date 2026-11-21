import { diffDays } from "../dates";
import type { AppState, Batch } from "../types";
import { averageStorageTemp, type QualityForecast } from "./forecast";
import { batchInventory } from "./inventory";
import { gradeMinScore } from "./quality";

export type PriorityLevel = "dispatch_now" | "dispatch_soon" | "review" | "monitor";

export interface PriorityComponent {
  key: string;
  label: string;
  value: number; // 0..100
  weight: number;
  detail: string;
}

export interface DispatchPriority {
  batchId: string;
  score: number;
  level: PriorityLevel;
  components: PriorityComponent[];
  reasons: string[];
  onHandKg: number;
  availableKg: number;
  nextDispatchDate?: string;
}

export const PRIORITY_WEIGHTS = {
  risk: 0.3,
  deadline: 0.22,
  acceptance: 0.14,
  age: 0.12,
  storage: 0.12,
  quantity: 0.1,
};

/** Deterministic dispatch priority ranking across every batch with stock on hand. */
export function rankDispatchPriority(state: AppState, forecasts: Map<string, QualityForecast>): DispatchPriority[] {
  const today = state.today;
  const rows: { b: Batch; inv: ReturnType<typeof batchInventory> }[] = state.batches
    .filter((b) => b.flag !== "rejected")
    .map((b) => ({ b, inv: batchInventory(b, state.inspections, state.allocations) }))
    .filter((r) => r.inv.onHandKg > 0);
  const maxOnHand = Math.max(1, ...rows.map((r) => r.inv.onHandKg));

  const out: DispatchPriority[] = rows.map(({ b, inv }) => {
    const cat = state.categories.find((c) => c.id === b.categoryId)!;
    const fc = forecasts.get(b.id);
    const comps: PriorityComponent[] = [];
    const reasons: string[] = [];

    const dl = fc?.daysToAcceptanceLimit ?? null;
    const risk = !fc ? 40 : dl === null ? 5 : Math.max(0, Math.min(100, 100 - dl * 11));
    comps.push({ key: "risk", label: "Quality deterioration risk", value: risk, weight: PRIORITY_WEIGHTS.risk, detail: !fc ? "Not yet inspected" : dl === null ? "No grade change expected within 21 days" : `~${dl} days to current-grade limit (simulated)` });
    if (fc && dl === 0) reasons.push(`Simulated forecast estimates quality has already fallen below inspected grade ${fc.inspection?.grade} — re-inspect and dispatch.`);
    else if (fc && dl !== null && dl <= 3) reasons.push(`Simulated forecast shows it may drop below grade ${fc.inspection?.grade} in ~${dl} days.`);
    if (!fc) reasons.push("Awaiting first inspection — quality unknown.");

    const pending = state.allocations.filter((a) => a.batchId === b.id && (a.dispatchStatus === "planned" || a.dispatchStatus === "loading"));
    const next = pending.map((a) => a.plannedDispatchDate).sort()[0];
    const dd = next ? diffDays(next, today) : null;
    const deadline = dd === null ? 0 : Math.max(0, Math.min(100, 100 - dd * 22));
    comps.push({ key: "deadline", label: "Order delivery deadline", value: deadline, weight: PRIORITY_WEIGHTS.deadline, detail: dd === null ? "No allocated orders" : dd <= 0 ? "Dispatch due today or overdue" : `Next dispatch in ${dd} days` });
    if (dd !== null && dd <= 1) reasons.push(dd < 0 ? "Allocated dispatch is overdue." : dd === 0 ? "Allocated dispatch is due today." : "Allocated dispatch is due tomorrow.");

    let acceptance = 0;
    let accDetail = "Not allocated";
    if (fc && pending.length) {
      const margins = pending.map((a) => {
        const o = state.orders.find((x) => x.id === a.orderId)!;
        const days = Math.max(0, diffDays(o.deliveryDate, today));
        return fc.scoreAt(days) - gradeMinScore(cat, o.acceptedGrade);
      });
      const m = Math.min(...margins);
      acceptance = Math.max(0, Math.min(100, 100 - m * 7));
      accDetail = `${Math.round(m * 10) / 10} pts above tightest buyer acceptance limit at delivery`;
      if (m < 0) reasons.push("Predicted quality at delivery is BELOW the buyer's acceptance limit — review the allocation.");
      else if (m < 5) reasons.push("Predicted quality at delivery is close to the buyer's acceptance limit.");
    } else if (fc) {
      const m = fc.estimatedScoreToday - gradeMinScore(cat, fc.inspection!.grade);
      acceptance = Math.max(0, Math.min(60, 60 - m * 5));
      accDetail = `${Math.round(m * 10) / 10} pts above own grade minimum`;
    }
    comps.push({ key: "acceptance", label: "Customer acceptance limits", value: acceptance, weight: PRIORITY_WEIGHTS.acceptance, detail: accDetail });

    const age = diffDays(today, b.arrivalDate);
    const ageV = Math.max(0, Math.min(100, age * 11));
    comps.push({ key: "age", label: "Arrival date", value: ageV, weight: PRIORITY_WEIGHTS.age, detail: `Arrived ${age} days ago` });
    if (age >= 7) reasons.push(`In storage for ${age} days.`);

    const { temp, fromLogs } = averageStorageTemp(b, today);
    const dev = Math.max(0, temp - cat.optimalTempC[1]);
    const chill = temp < cat.chillingThresholdC ? 40 : 0;
    const storage = Math.max(chill, Math.min(100, dev * 6.5));
    comps.push({ key: "storage", label: "Storage conditions", value: storage, weight: PRIORITY_WEIGHTS.storage, detail: `${temp}°C ${fromLogs ? "logged" : "assumed"}; ${dev > 0 ? `${Math.round(dev * 10) / 10}°C above optimal` : "within optimal"}` });
    if (dev >= 10) reasons.push(`Stored ${Math.round(dev)}°C above optimal temperature.`);

    const qty = Math.round((inv.onHandKg / maxOnHand) * 100);
    comps.push({ key: "quantity", label: "Available quantity", value: qty, weight: PRIORITY_WEIGHTS.quantity, detail: `${inv.onHandKg.toLocaleString()} kg on hand` });

    const score = Math.round(comps.reduce((s, c) => s + c.value * c.weight, 0));
    const level: PriorityLevel = score >= 62 ? "dispatch_now" : score >= 46 ? "dispatch_soon" : score >= 30 ? "review" : "monitor";
    if (reasons.length === 0) reasons.push("No urgent signals; continue routine monitoring.");
    return { batchId: b.id, score, level, components: comps, reasons, onHandKg: inv.onHandKg, availableKg: inv.availableKg, nextDispatchDate: next };
  });

  const code = (id: string) => state.batches.find((b) => b.id === id)?.code ?? id;
  return out.sort((a, b) => b.score - a.score || code(a.batchId).localeCompare(code(b.batchId)));
}
