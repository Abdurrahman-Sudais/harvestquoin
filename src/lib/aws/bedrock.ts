import { diffDays, fmtDate } from "../dates";
import type { DispatchPriority } from "../engine/priority";
import type { QualityForecast } from "../engine/forecast";
import type { Recommendation } from "../engine/allocation";
import type { AppState, Batch, Inspection, ProduceCategory } from "../types";
import { awsConfig } from "./config";

/**
 * AI Inspection Assistant — Amazon Bedrock adapter.
 *
 * The demo uses `MockBedrockAssistant`, a deterministic rule-based stand-in whose
 * responses are always labelled as mock AI output. `promptFor()` shows the exact
 * instruction that the production Bedrock integration would send.
 */

export interface AssistantSection {
  heading: string;
  items?: string[];
  text?: string;
  fields?: { label: string; value: string; confidence?: "high" | "medium" | "low" }[];
}

export interface AssistantResponse {
  tool: AssistantTool;
  title: string;
  sections: AssistantSection[];
  source: "mock" | "bedrock";
  model: string;
  generatedAt: string;
  structured?: Partial<StructuredNote>;
}

export type AssistantTool = "structure_notes" | "summarize_inspection" | "missing_info" | "explain_priority" | "dispatch_recommendations";

export interface StructuredNote {
  values: Record<string, number>;
  ripenessStage?: number;
  pulpTempC?: number;
  issues: string[];
  actions: string[];
}

export const TOOL_META: Record<AssistantTool, { label: string; description: string }> = {
  structure_notes: { label: "Structure inspection notes", description: "Turn free-text notes into structured inspection fields." },
  summarize_inspection: { label: "Summarise inspection report", description: "Concise summary of a batch's inspection history." },
  missing_info: { label: "Identify missing information", description: "Check inspections against the category's criteria." },
  explain_priority: { label: "Explain batch priority", description: "Why a batch was ranked where it is in the dispatch queue." },
  dispatch_recommendations: { label: "Generate dispatch recommendations", description: "Draft today's dispatch plan from priorities and allocations." },
};

export function promptFor(tool: AssistantTool): string {
  const base = "You are HarvestQuoin's produce inspection assistant. Use only the supplied data. Never state predicted grades as inspection results or guarantee shelf life.";
  const map: Record<AssistantTool, string> = {
    structure_notes: `${base} Extract the following JSON fields from the inspector's notes: colour_uniformity(1-10), appearance(1-10), firmness(1-10), damage_pct, decay_pct, brix, weight_loss_pct, ripeness_stage, pulp_temp_c, issues[], actions[]. Use null when not stated.`,
    summarize_inspection: `${base} Summarise the inspection records in <=120 words for a warehouse manager: current condition, trend, risks, next action.`,
    missing_info: `${base} Compare each inspection against the required criteria list and report missing or implausible values.`,
    explain_priority: `${base} Explain in plain language the dispatch priority score using the weighted components provided.`,
    dispatch_recommendations: `${base} Produce an ordered dispatch plan for today and tomorrow from the priority queue and approved allocations.`,
  };
  return map[tool];
}

const model = `${awsConfig.bedrock.modelId} (mock)`;
const now = () => new Date().toISOString();

const num = (s: string) => parseFloat(s.replace(",", "."));

export function structureNotes(text: string, cat: ProduceCategory): AssistantResponse {
  const t = ` ${text.toLowerCase()} `;
  const values: Record<string, number> = {};
  const fields: AssistantSection["fields"] = [];
  const issues: string[] = [];
  const actions: string[] = [];

  const pctNear = (words: string) => {
    const a = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*%\\s*(?:of\\s+(?:the\\s+)?(?:fruit|sample|lot)\\s+)?(?:\\w+\\s+){0,2}(?:${words})`).exec(t);
    const b = new RegExp(`(?:${words})\\w*\\s*(?:\\w+\\s+){0,3}?(?:at|of|around|about|~|approx\\.?|=|:)?\\s*(\\d+(?:[.,]\\d+)?)\\s*%`).exec(t);
    const m = a ?? b;
    return m ? num(m[1]) : undefined;
  };

  const dmg = pctNear("bruis|damag|crack|crush|split|cut");
  if (dmg !== undefined) {
    values.damage_pct = dmg;
    fields.push({ label: "Mechanical damage", value: `${dmg}%`, confidence: "high" });
  }
  const dec = pctNear("decay|mould|mold|rot|fung");
  if (dec !== undefined) {
    values.decay_pct = dec;
    fields.push({ label: "Decay / mould", value: `${dec}%`, confidence: "high" });
  }
  const wl = pctNear("weight loss|moisture loss|shrivel|dehydrat");
  if (wl !== undefined) {
    values.weight_loss_pct = wl;
    fields.push({ label: "Moisture / weight loss", value: `${wl}%`, confidence: "medium" });
  }
  const brix = /(\d+(?:[.,]\d+)?)\s*°?\s*brix/.exec(t) ?? /brix\s*(?:of|at|=|:)?\s*(\d+(?:[.,]\d+)?)/.exec(t);
  if (brix) {
    values.brix = num(brix[1]);
    fields.push({ label: "Soluble solids", value: `${values.brix} °Brix`, confidence: "high" });
  }
  const temp = /(\d+(?:[.,]\d+)?)\s*(?:°\s*c|degrees|deg\s*c|c\b)/.exec(t);
  let pulpTempC: number | undefined;
  if (temp) {
    pulpTempC = num(temp[1]);
    fields.push({ label: "Pulp temperature", value: `${pulpTempC} °C`, confidence: "medium" });
  }

  const firmMap: [RegExp, number, string][] = [
    [/very firm|rock hard/, 9, "very firm"],
    [/slightly soft|softening|easing/, 6, "slightly soft"],
    [/very soft|mushy|leaking/, 2, "very soft"],
    [/\bsoft\b/, 4, "soft"],
    [/\bfirm\b/, 8, "firm"],
  ];
  for (const [re, v, label] of firmMap)
    if (re.test(t)) {
      values.firmness = v;
      fields.push({ label: "Firmness", value: `${v}/10 (“${label}”)`, confidence: "medium" });
      break;
    }

  if (/uniform colou?r|even colou?r|evenly colou?red/.test(t)) {
    values.colour_uniformity = 9;
    fields.push({ label: "Colour uniformity", value: "9/10 (“uniform”)", confidence: "medium" });
  } else if (/mixed colou?r|uneven colou?r|patchy/.test(t)) {
    values.colour_uniformity = 5;
    fields.push({ label: "Colour uniformity", value: "5/10 (“mixed”)", confidence: "medium" });
  }
  if (/clean|no blemish|excellent appearance/.test(t)) {
    values.appearance = 9;
    fields.push({ label: "Visual defects", value: "9/10 (“clean”)", confidence: "low" });
  } else if (/blemish|scar|sunscald|sun scald|spots/.test(t)) {
    values.appearance = 6;
    fields.push({ label: "Visual defects", value: "6/10 (blemishes noted)", confidence: "low" });
  }

  let ripenessStage: number | undefined;
  const stages = cat.ripenessStages.map((s) => s.toLowerCase());
  const order = [...stages.keys()].sort((a, b) => stages[b].length - stages[a].length);
  for (const i of order) {
    if (new RegExp(`\\b${stages[i]}\\b`).test(t)) {
      ripenessStage = i;
      fields.push({ label: "Ripeness stage", value: cat.ripenessStages[i], confidence: "high" });
      break;
    }
  }

  const issueWords: [RegExp, string][] = [
    [/sunscald|sun scald/, "Sunscald"],
    [/crack/, "Cracking"],
    [/mould|mold|fung/, "Mould present"],
    [/insect|worm|borer/, "Insect damage"],
    [/chill/, "Possible chilling injury"],
    [/leak/, "Leaking fruit"],
    [/crush|compress/, "Compression / crushing"],
    [/warm|hot|high temp/, "Elevated temperature"],
  ];
  for (const [re, label] of issueWords) if (re.test(t)) issues.push(label);

  if ((values.decay_pct ?? 0) > cat.hardLimits.maxDecayPctForB) actions.push("Decay above Grade B limit — route to processing buyers only.");
  if ((values.damage_pct ?? 0) > cat.hardLimits.maxDamagePctForA) actions.push("Damage above Grade A limit — exclude from premium retail orders.");
  if (pulpTempC !== undefined && pulpTempC > cat.optimalTempC[1] + 6) actions.push("Move to cold room or prioritise dispatch; pulp temperature well above optimal.");
  if (issues.includes("Mould present")) actions.push("Cull visibly mouldy fruit and record rejected quantity.");
  if (actions.length === 0) actions.push("No immediate action indicated by the notes.");

  const missing = cat.criteria.filter((c) => c.required && values[c.key] === undefined).map((c) => c.label);
  if (ripenessStage === undefined) missing.push("Ripeness stage");
  if (pulpTempC === undefined) missing.push("Pulp temperature");

  return {
    tool: "structure_notes",
    title: "Structured inspection fields",
    source: "mock",
    model,
    generatedAt: now(),
    structured: { values, ripenessStage, pulpTempC, issues, actions },
    sections: [
      { heading: "Extracted fields", fields: fields.length ? fields : [{ label: "—", value: "No measurable fields recognised in the notes" }] },
      { heading: "Issues detected", items: issues.length ? issues : ["None mentioned"] },
      { heading: "Suggested actions", items: actions },
      { heading: "Still required before saving", items: missing.length ? missing : ["All required fields captured"] },
    ],
  };
}

export function summarizeInspection(batch: Batch, inspections: Inspection[], cat: ProduceCategory, fc: QualityForecast | null, today: string): AssistantResponse {
  const mine = inspections.filter((i) => i.batchId === batch.id).sort((a, b) => a.date.localeCompare(b.date));
  if (!mine.length)
    return { tool: "summarize_inspection", title: `Summary · ${batch.code}`, source: "mock", model, generatedAt: now(), sections: [{ heading: "Summary", text: "No inspections recorded for this batch yet. Schedule an arrival inspection before allocation." }] };
  const first = mine[0];
  const last = mine[mine.length - 1];
  const delta = Math.round((last.qualityScore - first.qualityScore) * 10) / 10;
  const rejected = mine.reduce((s, i) => s + i.rejectedQtyKg, 0);
  const text =
    `${batch.code} (${batch.variety}, ${batch.arrivalQtyKg.toLocaleString()} kg) has ${mine.length} inspection${mine.length > 1 ? "s" : ""}. ` +
    `Latest on ${fmtDate(last.date)} by ${last.inspector}: score ${last.qualityScore}, grade ${last.grade}, ripeness "${cat.ripenessStages[last.ripenessStage]}", damage ${last.values.damage_pct ?? "—"}%, decay ${last.values.decay_pct ?? "—"}%. ` +
    (mine.length > 1 ? `Score has moved ${delta >= 0 ? "+" : ""}${delta} points since arrival. ` : "") +
    (rejected ? `${rejected.toLocaleString()} kg culled across inspections. ` : "") +
    (fc ? `The simulated forecast (not an inspection result) estimates grade ${fc.predictedGrade} in ${fc.horizonDays} days with ${fc.confidence.level.toLowerCase()} confidence.` : "");
  const risks: string[] = [];
  if ((last.values.damage_pct ?? 0) > cat.hardLimits.maxDamagePctForA) risks.push("Damage exceeds the premium (Grade A) limit.");
  if ((last.values.decay_pct ?? 0) > 1) risks.push("Decay present — monitor closely for spread.");
  if (last.pulpTempC > cat.optimalTempC[1] + 6) risks.push(`Pulp temperature ${last.pulpTempC}°C is well above the ${cat.optimalTempC[1]}°C optimum.`);
  if (diffDays(today, last.date) > 3) risks.push(`Last inspection is ${diffDays(today, last.date)} days old.`);
  if (fc && fc.acceptanceRisk !== "low") risks.push(`Acceptance-limit risk is ${fc.acceptanceRisk} (simulated).`);
  return {
    tool: "summarize_inspection",
    title: `Summary · ${batch.code}`,
    source: "mock",
    model,
    generatedAt: now(),
    sections: [
      { heading: "Summary", text },
      { heading: "Risks", items: risks.length ? risks : ["No material risks noted."] },
      { heading: "Inspector notes (latest)", text: `“${last.notes}”` },
      { heading: "Next action", text: fc ? `Re-inspect by ${fmtDate(fc.recommendedReviewDate, { weekday: true })}.` : "Record an inspection." },
    ],
  };
}

export function identifyMissing(state: AppState, batchIds?: string[]): AssistantResponse {
  const cat = state.categories[0];
  const items: string[] = [];
  const scope = state.batches.filter((b) => (batchIds ? batchIds.includes(b.id) : b.arrivalDate >= addDaysSafe(state.today, -10)));
  for (const b of scope) {
    const ins = state.inspections.filter((i) => i.batchId === b.id);
    if (!ins.length) {
      items.push(`${b.code}: no inspection recorded.`);
      continue;
    }
    for (const i of ins) {
      const miss = cat.criteria.filter((c) => c.required && (i.values[c.key] === undefined || Number.isNaN(i.values[c.key]))).map((c) => c.label);
      const opt = cat.criteria.filter((c) => !c.required && i.values[c.key] === undefined).map((c) => c.label);
      if (miss.length) items.push(`${b.code} · ${fmtDate(i.date)}: missing required ${miss.join(", ")}.`);
      if (opt.length) items.push(`${b.code} · ${fmtDate(i.date)}: optional not recorded — ${opt.join(", ")}.`);
      if (!i.photos.length && i.type === "arrival") items.push(`${b.code} · ${fmtDate(i.date)}: no arrival photographs attached.`);
      if (i.rejectedQtyKg > 0 && !i.rejectionReason) items.push(`${b.code} · ${fmtDate(i.date)}: rejected quantity without a reason.`);
    }
    if (!b.temperatureLog.length) items.push(`${b.code}: no temperature records — forecast confidence reduced.`);
  }
  return {
    tool: "missing_info",
    title: "Missing inspection information",
    source: "mock",
    model,
    generatedAt: now(),
    sections: [{ heading: `${scope.length} batch${scope.length === 1 ? "" : "es"} checked`, items: items.length ? items : ["All inspections are complete."] }],
  };
}

function addDaysSafe(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function explainPriority(batch: Batch, p: DispatchPriority | undefined, rank: number, total: number): AssistantResponse {
  if (!p)
    return { tool: "explain_priority", title: `Priority · ${batch.code}`, source: "mock", model, generatedAt: now(), sections: [{ heading: "Explanation", text: "This batch has no stock on hand, so it is not in the dispatch queue." }] };
  const top = [...p.components].sort((a, b) => b.value * b.weight - a.value * a.weight);
  return {
    tool: "explain_priority",
    title: `Priority · ${batch.code}`,
    source: "mock",
    model,
    generatedAt: now(),
    sections: [
      { heading: "Explanation", text: `${batch.code} is ranked #${rank} of ${total} with a priority score of ${p.score}/100 (${p.level.replace("_", " ")}). The biggest contributors are ${top[0].label.toLowerCase()} and ${top[1].label.toLowerCase()}.` },
      { heading: "Weighted factors", fields: top.map((c) => ({ label: `${c.label} (×${c.weight})`, value: `${Math.round(c.value)} → ${Math.round(c.value * c.weight)} pts · ${c.detail}` })) },
      { heading: "Signals", items: p.reasons },
    ],
  };
}

export function dispatchRecommendations(state: AppState, queue: DispatchPriority[], recs: Recommendation[]): AssistantResponse {
  const code = (id: string) => state.batches.find((b) => b.id === id)?.code ?? id;
  const now1 = queue.filter((q) => q.level === "dispatch_now");
  const soon = queue.filter((q) => q.level === "dispatch_soon");
  const due = state.allocations.filter((a) => (a.dispatchStatus === "planned" || a.dispatchStatus === "loading") && a.plannedDispatchDate <= addDaysSafe(state.today, 1));
  const items: string[] = [];
  for (const a of due.sort((x, y) => x.plannedDispatchDate.localeCompare(y.plannedDispatchDate))) {
    const o = state.orders.find((x) => x.id === a.orderId)!;
    items.push(`${a.plannedDispatchDate <= state.today ? "TODAY" : "Tomorrow"}: load ${a.qtyKg.toLocaleString()} kg from ${code(a.batchId)} for ${o.customer} (${o.code}).`);
  }
  const unalloc: string[] = [];
  for (const q of [...now1, ...soon]) {
    const r = recs.filter((x) => x.batchId === q.batchId);
    if (r.length) {
      for (const x of r) {
        const o = state.orders.find((y) => y.id === x.orderId)!;
        unalloc.push(`Approve ${x.qtyKg.toLocaleString()} kg of ${code(q.batchId)} → ${o.customer} (suitability ${x.suitability}).`);
      }
    } else if (q.availableKg > 0) unalloc.push(`${code(q.batchId)}: ${q.availableKg.toLocaleString()} kg urgent with no compatible open order — offer to processing or spot buyers.`);
  }
  return {
    tool: "dispatch_recommendations",
    title: `Dispatch plan · ${fmtDate(state.today, { weekday: true })}`,
    source: "mock",
    model,
    generatedAt: now(),
    sections: [
      { heading: "Approved loads due", items: items.length ? items : ["No approved loads due today or tomorrow."] },
      { heading: "Urgent batches — recommended actions", items: unalloc.length ? unalloc : ["No urgent batches."] },
      { heading: "Watch list", items: queue.filter((q) => q.level === "review").slice(0, 5).map((q) => `${code(q.batchId)} — ${q.reasons[0]}`) },
    ],
  };
}
