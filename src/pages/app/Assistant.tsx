import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, Wand2, FileText, SearchCheck, HelpCircle, Truck, Send, Copy, Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SimulatedTag } from "@/components/shared";
import { useStore } from "@/lib/store";
import { TOOL_META, promptFor, structureNotes, summarizeInspection, identifyMissing, explainPriority, dispatchRecommendations, type AssistantResponse, type AssistantTool } from "@/lib/aws/bedrock";
import { awsConfig } from "@/lib/aws/config";
import { cn } from "@/lib/utils";

const ICONS: Record<AssistantTool, typeof Wand2> = { structure_notes: Wand2, summarize_inspection: FileText, missing_info: SearchCheck, explain_priority: HelpCircle, dispatch_recommendations: Truck };
const SAMPLE = "Lot mostly pink to light red, firm, fairly uniform colour. About 7% bruised from basket compression on the bottom layer, 1.5% mould spots. Pulp temp 27°C on arrival — warm. Brix 5.1. Some sunscald on shoulders.";

export default function Assistant() {
  const { state, derived, category } = useStore();
  const [params] = useSearchParams();
  const [tool, setTool] = useState<AssistantTool>((params.get("tool") as AssistantTool) || "structure_notes");
  const [batchId, setBatchId] = useState(params.get("batch") || "");
  const [notes, setNotes] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: AssistantResponse }[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const batches = state.batches.filter((b) => (derived.inventory.get(b.id)?.onHandKg ?? 0) > 0).sort((a, b) => a.code.localeCompare(b.code));
  const needsBatch = tool === "summarize_inspection" || tool === "explain_priority";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);
  useEffect(() => { if (params.get("tool") && params.get("batch")) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    const b = state.batches.find((x) => x.id === batchId);
    if (needsBatch && !b) return toast.error("Select a batch");
    if (tool === "structure_notes" && notes.trim().length < 10) return toast.error("Enter inspection notes");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 650));
    const cat = state.categories[0];
    let a: AssistantResponse;
    let q: string;
    switch (tool) {
      case "structure_notes": a = structureNotes(notes, cat); q = `Structure these notes: “${notes.slice(0, 140)}${notes.length > 140 ? "…" : ""}”`; break;
      case "summarize_inspection": a = summarizeInspection(b!, state.inspections, category(b!.categoryId), derived.forecasts.get(b!.id) ?? null, state.today); q = `Summarise inspections for ${b!.code}`; break;
      case "missing_info": a = identifyMissing(state, b ? [b.id] : undefined); q = b ? `Check ${b.code} for missing inspection information` : "Check recent batches for missing inspection information"; break;
      case "explain_priority": { const idx = derived.priority.findIndex((p) => p.batchId === b!.id); a = explainPriority(b!, derived.priority[idx], idx + 1, derived.priority.length); q = `Why is ${b!.code} prioritised this way?`; break; }
      default: a = dispatchRecommendations(state, derived.priority, derived.plan.recommendations); q = "Generate today's dispatch recommendations";
    }
    setThread((t) => [...t, { q, a }]);
    setBusy(false);
  };

  const copy = (a: AssistantResponse) => {
    const txt = [a.title, ...a.sections.map((s) => `\n${s.heading}\n${s.text ?? ""}${(s.items ?? []).map((i) => `- ${i}`).join("\n")}${(s.fields ?? []).map((f) => `- ${f.label}: ${f.value}`).join("\n")}`)].join("\n");
    navigator.clipboard?.writeText(txt).then(() => toast.success("Copied"), () => toast.error("Clipboard unavailable"));
  };

  return (
    <div>
      <PageHeader eyebrow="Intelligence" title="AI inspection assistant" description="Structure free-text notes, summarise inspection reports, identify missing information, explain priorities and generate dispatch recommendations." actions={<SimulatedTag kind="ai" />} />
      <Card className="mb-6 flex items-start gap-3 border-violet-200 bg-violet-50/60 p-4 text-sm text-violet-900">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <div><span className="font-semibold">Mock AI responses.</span> This demonstration uses a deterministic rule-based stand-in for Amazon Bedrock (<code className="rounded bg-violet-100 px-1 text-xs">{awsConfig.bedrock.modelId}</code>). Responses are built only from your HarvestQuoin data and are always labelled. Verify before acting.</div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Choose a task</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {(Object.keys(TOOL_META) as AssistantTool[]).map((t) => {
                const Icon = ICONS[t];
                return (
                  <button key={t} onClick={() => setTool(t)} className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors", tool === t ? "border-forest-600 bg-forest-50" : "hover:bg-muted/50")}>
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tool === t ? "text-forest-700" : "text-muted-foreground")} />
                    <div><div className="text-sm font-medium">{TOOL_META[t].label}</div><div className="text-xs text-muted-foreground">{TOOL_META[t].description}</div></div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
        <Card className="flex min-h-[600px] flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b pb-4">
            <div><CardTitle>{TOOL_META[tool].label}</CardTitle><CardDescription>{TOOL_META[tool].description}</CardDescription></div>
            <Button size="sm" variant="ghost" onClick={() => setShowPrompt(!showPrompt)}><Code2 /> Bedrock prompt</Button>
          </CardHeader>
          {showPrompt && <pre className="mx-5 mt-4 whitespace-pre-wrap rounded-lg bg-forest-950 p-3 text-[11px] text-lime-200">{promptFor(tool)}</pre>}
          <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
            {thread.length === 0 && <div className="flex h-full flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground"><Sparkles className="mb-3 h-8 w-8 text-violet-400" />Pick a task, provide the input below and run it.</div>}
            {thread.map(({ q, a }, i) => (
              <div key={i} className="space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-forest-800 px-4 py-2.5 text-sm text-white">{q}</div>
                <div className="max-w-[95%] rounded-2xl rounded-bl-sm border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /><span className="font-semibold">{a.title}</span><SimulatedTag kind="ai" /><button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => copy(a)} aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button></div>
                  <div className="space-y-3">
                    {a.sections.map((s) => (
                      <div key={s.heading}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.heading}</div>
                        {s.text && <p className="mt-1 text-sm leading-relaxed">{s.text}</p>}
                        {s.items && <ul className="mt-1 space-y-1 text-sm">{s.items.map((it) => <li key={it} className="flex gap-2"><span className="text-forest-500">•</span>{it}</li>)}</ul>}
                        {s.fields && <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">{s.fields.map((f) => <div key={f.label} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"><span className="text-muted-foreground">{f.label}: </span><span className="font-medium">{f.value}</span>{f.confidence && <span className={cn("ml-1.5 text-[10px] uppercase", f.confidence === "high" ? "text-forest-600" : f.confidence === "medium" ? "text-amber-600" : "text-red-500")}>{f.confidence}</span>}</div>)}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] text-muted-foreground">{a.model} · {new Date(a.generatedAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating mock response…</div>}
            <div ref={endRef} />
          </div>
          <div className="space-y-3 border-t p-4">
            {tool === "structure_notes" && <div className="space-y-1.5"><Label>Inspection notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>}
            {(needsBatch || tool === "missing_info") && (
              <div className="space-y-1.5"><Label>{tool === "missing_info" ? "Batch (optional — default checks recent batches)" : "Batch"}</Label>
                <Select value={batchId || "__none"} onValueChange={(v) => setBatchId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>{tool === "missing_info" && <SelectItem value="__none">All recent batches</SelectItem>}{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.variety}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={run} disabled={busy} className="w-full sm:w-auto"><Send /> Run {TOOL_META[tool].label.toLowerCase()}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
