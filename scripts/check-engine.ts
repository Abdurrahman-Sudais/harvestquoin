import { buildSeedState } from "../src/lib/seed";
import { forecastProvider } from "../src/lib/engine/forecast";
import { batchInventory, batchStatus, latestInspection } from "../src/lib/engine/inventory";
import { recommendAllocations } from "../src/lib/engine/allocation";
import { rankDispatchPriority } from "../src/lib/engine/priority";

const s = buildSeedState("2026-11-21");
const fc = new Map();
for (const b of s.batches) {
  const f = forecastProvider.forecast({ batch: b, category: s.categories[0], inspections: s.inspections, supplier: s.suppliers.find((x) => x.id === b.supplierId), asOf: s.today });
  if (f) fc.set(b.id, f);
}
let bad = 0;
for (const b of s.batches) {
  const inv = batchInventory(b, s.inspections, s.allocations);
  if (inv.allocatedKg > inv.netKg) { bad++; console.log("OVER", b.code); }
  const f = fc.get(b.id); const li = latestInspection(b.id, s.inspections);
  if (Number(b.id.slice(2)) < 100) console.log(b.code, b.variety.padEnd(9), batchStatus(b, inv, s.inspections, s.allocations).padEnd(20), "avail", inv.availableKg, "| insp", li?.qualityScore, li?.grade, "| today", f?.estimatedScoreToday, f?.predictedGradeToday, "| +3", f?.predictedGrade, "decay", f?.dailyDecay, "dl", f?.daysToAcceptanceLimit, f?.acceptanceRisk, f?.confidence.level);
}
const plan = recommendAllocations(s, fc);
console.log("\nRECS");
for (const r of plan.recommendations) console.log(s.orders.find(o=>o.id===r.orderId)!.customer.padEnd(30), s.batches.find(b=>b.id===r.batchId)!.code, r.qtyKg, r.suitability, r.compatibility, r.predictedGradeAtDelivery, r.marginAtDelivery);
console.log("SHORT", plan.shortfalls.map(x => [s.orders.find(o=>o.id===x.orderId)!.customer, x.shortKg, x.reason]));
console.log("\nPRIORITY");
for (const p of rankDispatchPriority(s, fc)) console.log(s.batches.find(b=>b.id===p.batchId)!.code, p.score, p.level, p.reasons[0]);
console.log("overallocated:", bad);
