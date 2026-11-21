import type { GradeCode, InspectionCriterion, ProduceCategory } from "../types";

export const GRADE_ORDER: GradeCode[] = ["A", "B", "C", "R"];

/** Returns true if grade `a` meets or exceeds grade `b`. */
export function gradeMeets(a: GradeCode, b: GradeCode) {
  return GRADE_ORDER.indexOf(a) <= GRADE_ORDER.indexOf(b);
}

export function gradeLabel(cat: ProduceCategory, code: GradeCode) {
  return cat.grades.find((g) => g.code === code)?.label ?? code;
}

export function gradeMinScore(cat: ProduceCategory, code: GradeCode) {
  return cat.grades.find((g) => g.code === code)?.minScore ?? 0;
}

/** Normalise one criterion reading to 0..1 where 1 is best. */
export function normaliseCriterion(c: InspectionCriterion, v: number): number {
  if (Number.isNaN(v)) return 0;
  if (c.type === "number" && c.ideal) {
    const [lo, hi] = c.ideal;
    if (v >= lo && v <= hi) return 1;
    const span = Math.max(hi - lo, (c.max - c.min) / 4);
    const dev = v < lo ? lo - v : v - hi;
    return Math.max(0, 1 - dev / span);
  }
  const t = (v - c.min) / (c.max - c.min || 1);
  const clamped = Math.max(0, Math.min(1, t));
  return c.higherIsBetter ? clamped : 1 - clamped;
}

/** Composite 0–100 quality score from recorded inspection values (deterministic). */
export function computeQualityScore(cat: ProduceCategory, values: Record<string, number>): number {
  let wsum = 0;
  let acc = 0;
  for (const c of cat.criteria) {
    if (c.weight <= 0) continue;
    const v = values[c.key];
    if (v === undefined || v === null || Number.isNaN(v)) continue;
    acc += normaliseCriterion(c, v) * c.weight;
    wsum += c.weight;
  }
  if (wsum === 0) return 0;
  return Math.round((acc / wsum) * 1000) / 10;
}

export function gradeFromScore(cat: ProduceCategory, score: number): GradeCode {
  const sorted = [...cat.grades].sort((a, b) => b.minScore - a.minScore);
  for (const g of sorted) if (score >= g.minScore) return g.code;
  return "R";
}

/** Grade from score, then apply hard limits on damage / decay. */
export function computeGrade(cat: ProduceCategory, score: number, values: Record<string, number>): GradeCode {
  let g = gradeFromScore(cat, score);
  const damage = values.damage_pct ?? 0;
  const decay = values.decay_pct ?? 0;
  const capAt = (cap: GradeCode) => {
    if (GRADE_ORDER.indexOf(g) < GRADE_ORDER.indexOf(cap)) g = cap;
  };
  if (damage > cat.hardLimits.maxDamagePctForA) capAt("B");
  if (decay > cat.hardLimits.maxDecayPctForB) capAt("C");
  if (decay > cat.hardLimits.maxDecayPctCommercial) capAt("R");
  return g;
}
