import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Camera, FileUp, Sparkles, Trash2, Wand2, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradeBadge, PageHeader, SimulatedTag, ScoreBar } from "@/components/shared";
import { useStore } from "@/lib/store";
import { INSPECTORS } from "@/lib/seed";
import { computeGrade, computeQualityScore, normaliseCriterion } from "@/lib/engine/quality";
import { structureNotes } from "@/lib/aws/bedrock";
import { s3 } from "@/lib/aws/services";
import { fmtKg } from "@/lib/utils";
import type { InspectionDocument, InspectionPhoto } from "@/lib/types";

const GROUP_LABEL: Record<string, string> = { visual: "Visual quality", physical: "Physical condition", damage: "Damage levels", measurement: "Measurements" };

async function compressImage(file: File, max = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function InspectionForm() {
  const { state, derived, addInspection } = useStore();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const cat = state.categories[0];
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [docs, setDocs] = useState<InspectionDocument[]>([]);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const eligible = state.batches.filter((b) => !["dispatched", "rejected"].includes(derived.status.get(b.id)!)).sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));

  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const c of cat.criteria) {
      const base = z.coerce.number({ invalid_type_error: "Required" }).min(c.min, `Min ${c.min}`).max(c.max, `Max ${c.max}`);
      shape[c.key] = c.required ? base : z.union([z.literal(""), base]).optional();
    }
    return z
      .object({
        batchId: z.string().min(1, "Select a batch"),
        date: z.string().min(1).refine((d) => d <= state.today, "Cannot be in the future"),
        type: z.enum(["arrival", "storage", "pre_dispatch"]),
        inspector: z.string().min(2, "Inspector is required"),
        ripenessStage: z.coerce.number().int().min(0).max(cat.ripenessStages.length - 1),
        pulpTempC: z.coerce.number({ invalid_type_error: "Required" }).min(-5).max(50),
        rejectedQtyKg: z.coerce.number().int("Whole kg").min(0),
        rejectionReason: z.string().optional(),
        notes: z.string().max(2000),
        values: z.object(shape),
      })
      .refine((v) => v.rejectedQtyKg === 0 || (v.rejectionReason ?? "").trim().length >= 3, { message: "Give a reason for the rejected quantity", path: ["rejectionReason"] });
  }, [cat, state.today]);
  type F = z.infer<typeof schema>;

  const preBatch = params.get("batch") ?? "";
  const preHasInsp = state.inspections.some((i) => i.batchId === preBatch);
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: preBatch, date: state.today, type: preHasInsp ? "storage" : "arrival", inspector: state.inspections.length ? INSPECTORS[0] : "", ripenessStage: 2, pulpTempC: "" as unknown as number, rejectedQtyKg: 0, rejectionReason: "", notes: "", values: Object.fromEntries(cat.criteria.map((c) => [c.key, ""])) as F["values"] },
  });

  const v = watch();
  const numericValues = Object.fromEntries(Object.entries(v.values ?? {}).filter(([, x]) => x !== "" && x !== undefined && !Number.isNaN(Number(x))).map(([k, x]) => [k, Number(x)]));
  const score = computeQualityScore(cat, numericValues);
  const grade = computeGrade(cat, score, numericValues);
  const requiredDone = cat.criteria.filter((c) => c.required).every((c) => numericValues[c.key] !== undefined);
  const selected = state.batches.find((b) => b.id === v.batchId);
  const inv = selected ? derived.inventory.get(selected.id) : undefined;

  const runAI = () => {
    if (!v.notes || v.notes.trim().length < 10) return toast.error("Write or paste at least a sentence of inspection notes first.");
    const r = structureNotes(v.notes, cat);
    const s = r.structured!;
    let n = 0;
    for (const [k, val] of Object.entries(s.values ?? {})) { setValue(`values.${k}` as never, val as never, { shouldValidate: true }); n++; }
    if (s.ripenessStage !== undefined) { setValue("ripenessStage", s.ripenessStage, { shouldValidate: true }); n++; }
    if (s.pulpTempC !== undefined) { setValue("pulpTempC", s.pulpTempC, { shouldValidate: true }); n++; }
    const missing = r.sections.find((x) => x.heading.startsWith("Still required"))?.items ?? [];
    setAiNote(`Filled ${n} field${n === 1 ? "" : "s"} from notes. ${s.issues?.length ? `Issues: ${s.issues.join(", ")}. ` : ""}${missing[0] === "All required fields captured" ? "" : `Still needed: ${missing.join(", ")}.`}`);
    toast.success(`Mock AI structured ${n} field${n === 1 ? "" : "s"} — please verify before saving`);
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list: InspectionPhoto[] = [];
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      if (!f.type.startsWith("image/")) continue;
      try { list.push({ id: `p-${Date.now()}-${list.length}`, name: f.name, dataUrl: await compressImage(f) }); } catch { toast.error(`Could not read ${f.name}`); }
    }
    setPhotos((p) => [...p, ...list]);
  };
  const onDocs = (files: FileList | null) => {
    if (!files || !v.batchId) return toast.error("Select a batch first");
    const list = Array.from(files).map((f, i) => ({ id: `d-${Date.now()}-${i}`, name: f.name, sizeBytes: f.size, mimeType: f.type || "application/octet-stream", uploadedAt: new Date().toISOString(), s3Key: s3.objectKey(v.batchId, f.name) }));
    setDocs((d) => [...d, ...list]);
  };

  const onSubmit = (data: F) => {
    const values = Object.fromEntries(Object.entries(data.values).filter(([, x]) => x !== "" && x !== undefined).map(([k, x]) => [k, Number(x)]));
    const r = addInspection({ batchId: data.batchId, date: data.date, type: data.type, inspector: data.inspector, values, ripenessStage: data.ripenessStage, pulpTempC: data.pulpTempC, rejectedQtyKg: data.rejectedQtyKg, rejectionReason: data.rejectionReason || undefined, notes: data.notes, photos, documents: docs });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Inspection saved — grade ${r.value.grade} (${r.value.qualityScore})`, { description: "Forecast, priorities and allocation recommendations have been updated." });
    nav(`/app/batches/${data.batchId}`);
  };

  const E = ({ m }: { m?: string }) => (m ? <p className="text-xs text-red-600">{m}</p> : null);
  const groups = ["visual", "physical", "damage", "measurement"] as const;

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2"><Link to="/app/inspections"><ArrowLeft /> Inspections</Link></Button>
      <PageHeader eyebrow="Workflow · Step 2" title="Record inspection" description={`Criteria configured for ${cat.name}. Adjust weights and thresholds in Settings.`} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Inspection details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Batch</Label>
                <Controller control={control} name="batchId" render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select batch…" /></SelectTrigger>
                    <SelectContent>{eligible.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.variety} · {b.storageLocation}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                <E m={errors.batchId?.message} />
              </div>
              <div className="space-y-1.5"><Label>Inspection type</Label>
                <Controller control={control} name="type" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arrival">Arrival</SelectItem><SelectItem value="storage">Storage</SelectItem><SelectItem value="pre_dispatch">Pre-dispatch</SelectItem></SelectContent></Select>
                )} />
              </div>
              <div className="space-y-1.5"><Label htmlFor="date">Inspection date</Label><Input id="date" type="date" max={state.today} {...register("date")} /><E m={errors.date?.message} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="insp">Inspector</Label><Input id="insp" list="inspectors" {...register("inspector")} /><datalist id="inspectors">{INSPECTORS.map((i) => <option key={i} value={i} />)}</datalist><E m={errors.inspector?.message} /></div>
              <div className="space-y-1.5"><Label>Ripeness stage</Label>
                <Controller control={control} name="ripenessStage" render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(x) => field.onChange(Number(x))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cat.ripenessStages.map((s, i) => <SelectItem key={s} value={String(i)}>{i + 1}. {s}</SelectItem>)}</SelectContent></Select>
                )} />
              </div>
              <div className="space-y-1.5"><Label htmlFor="pulp">Pulp temperature (°C)</Label><Input id="pulp" type="number" step={0.1} {...register("pulpTempC")} /><E m={errors.pulpTempC?.message} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div><CardTitle>Inspector notes</CardTitle><CardDescription>Write freely — the AI assistant can structure notes into the fields below.</CardDescription></div>
              <SimulatedTag kind="ai" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={4} placeholder="e.g. Mostly pink, firm, uniform colour. About 4% bruised from crate pressure, 0.5% mould. Pulp 14°C. Brix 5.4." {...register("notes")} />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={runAI}><Wand2 /> Structure notes with AI</Button>
                {aiNote && <span className="flex items-center gap-1 text-xs text-violet-700"><Sparkles className="h-3 w-3" />{aiNote}</span>}
              </div>
            </CardContent>
          </Card>

          {groups.map((g) => {
            const crit = cat.criteria.filter((c) => c.group === g);
            if (!crit.length) return null;
            return (
              <Card key={g}>
                <CardHeader><CardTitle>{GROUP_LABEL[g]}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {crit.map((c) => {
                    const raw = v.values?.[c.key];
                    const has = raw !== "" && raw !== undefined && !Number.isNaN(Number(raw));
                    const norm = has ? normaliseCriterion(c, Number(raw)) : 0;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const err = (errors.values as any)?.[c.key]?.message as string | undefined;
                    return (
                      <div key={c.key} className="space-y-1.5">
                        <div className="flex items-center justify-between"><Label htmlFor={c.key}>{c.label}{c.required && <span className="text-red-500"> *</span>}</Label><span className="text-[11px] text-muted-foreground">{c.type === "score10" ? "1–10" : `${c.min}–${c.max} ${c.unit ?? ""}`}{c.weight ? ` · weight ${c.weight}` : ""}</span></div>
                        <Input id={c.key} type="number" step={c.type === "score10" ? 1 : 0.1} min={c.min} max={c.max} {...register(`values.${c.key}` as never)} />
                        {has && <ScoreBar score={norm * 100} className="h-1" />}
                        {c.help && <p className="text-[11px] text-muted-foreground">{c.help}</p>}
                        <E m={err} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader><CardTitle>Photographs & documents</CardTitle><CardDescription>Stored against the inspection (Amazon S3 in production; metadata only in this demo, photos kept as thumbnails).</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onPhotos(e.target.files); e.target.value = ""; }} />
                <input ref={docRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png" onChange={(e) => { onDocs(e.target.files); e.target.value = ""; }} />
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={photos.length >= 6}><Camera /> Add photos ({photos.length}/6)</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => docRef.current?.click()}><FileUp /> Upload documents</Button>
              </div>
              {photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((p) => <div key={p.id} className="group relative"><img src={p.dataUrl} alt={p.name} className="h-20 w-20 rounded-lg object-cover" /><button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-600 p-1 text-white group-hover:block"><Trash2 className="h-3 w-3" /></button></div>)}</div>}
              {docs.length > 0 && <div className="space-y-1">{docs.map((d) => <div key={d.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"><FileText className="h-3.5 w-3.5" /><span className="font-medium">{d.name}</span><span className="text-muted-foreground">{(d.sizeBytes / 1024).toFixed(0)} KB · {d.s3Key}</span><button type="button" className="ml-auto text-red-600" onClick={() => setDocs(docs.filter((x) => x.id !== d.id))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rejected quantity</CardTitle><CardDescription>Fruit culled at this inspection is deducted from the batch's saleable inventory.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="rej">Rejected (kg)</Label><Input id="rej" type="number" min={0} step={1} max={inv?.availableKg} {...register("rejectedQtyKg")} /><E m={errors.rejectedQtyKg?.message} />{inv && <p className="text-[11px] text-muted-foreground">Max {fmtKg(inv.availableKg)} (unallocated stock)</p>}</div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rr">Reason</Label><Input id="rr" placeholder="e.g. Crushed fruit, mould" {...register("rejectionReason")} /><E m={errors.rejectionReason?.message} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader><CardTitle>Calculated result</CardTitle><CardDescription>Actual inspection result from recorded values</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <GradeBadge grade={grade} size="lg" />
                <div><div className="font-display text-3xl font-bold">{score || "—"}</div><div className="text-xs text-muted-foreground">Composite quality score</div></div>
              </div>
              <ScoreBar score={score} />
              <div className="text-xs text-muted-foreground">{cat.grades.find((g) => g.code === grade)?.description}</div>
              {(numericValues.damage_pct ?? 0) > cat.hardLimits.maxDamagePctForA && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">Damage above {cat.hardLimits.maxDamagePctForA}% caps grade at B.</p>}
              {(numericValues.decay_pct ?? 0) > cat.hardLimits.maxDecayPctForB && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">Decay above {cat.hardLimits.maxDecayPctForB}% caps grade at C.</p>}
              {!requiredDone && <p className="text-xs text-muted-foreground">Complete all required (*) criteria to save.</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>Save inspection</Button>
            </CardContent>
          </Card>
          {selected && inv && (
            <Card className="p-4 text-sm">
              <div className="font-semibold">{selected.code}</div>
              <div className="text-xs text-muted-foreground">{selected.variety} · {selected.storageLocation}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><span className="text-muted-foreground">Net:</span> {fmtKg(inv.netKg)}</div><div><span className="text-muted-foreground">Available:</span> {fmtKg(inv.availableKg)}</div></div>
            </Card>
          )}
        </div>
      </form>
    </div>
  );
}
