import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea } from "recharts";
import { ArrowLeft, ClipboardCheck, PauseCircle, PlayCircle, Ban, Thermometer, MapPin, Truck, Box, Snowflake, FileText, Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, GradeBadge, PageHeader, Stat, ToneBadge, SimulatedTag } from "@/components/shared";
import { ForecastSummary, NoForecast } from "@/components/shared/ForecastPanel";
import { useStore } from "@/lib/store";
import { useLookups } from "@/hooks/useRows";
import { BATCH_STATUS, DISPATCH_STATUS, INSPECTION_TYPE, PACKAGING, PRIORITY, STORAGE, TRANSPORT } from "@/lib/labels";
import { diffDays, fmtDate } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";

export default function BatchDetail() {
  const { id } = useParams();
  const { state, derived, updateBatch, category } = useStore();
  const { sup, wh, order: orderMap } = useLookups();
  const [flagDialog, setFlagDialog] = useState<null | "on_hold" | "rejected">(null);
  const [reason, setReason] = useState("");
  const [tempOpen, setTempOpen] = useState(false);
  const [temp, setTemp] = useState({ date: state.today, tempC: "", humidity: "" });

  const batch = state.batches.find((b) => b.id === id);
  if (!batch) return <EmptyState icon={Box} title="Batch not found" action={<Button asChild><Link to="/app/batches">Back to batches</Link></Button>} />;
  const cat = category(batch.categoryId);
  const inv = derived.inventory.get(batch.id)!;
  const status = derived.status.get(batch.id)!;
  const fc = derived.forecasts.get(batch.id) ?? null;
  const pr = derived.priority.find((p) => p.batchId === batch.id);
  const rank = derived.priority.findIndex((p) => p.batchId === batch.id) + 1;
  const inspections = state.inspections.filter((i) => i.batchId === batch.id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const allocations = state.allocations.filter((a) => a.batchId === batch.id);
  const supplier = sup.get(batch.supplierId)!;
  const warehouse = wh.get(batch.warehouseId)!;
  const recs = derived.plan.recommendations.filter((r) => r.batchId === batch.id);

  const history = [...inspections].reverse().map((i) => ({ label: fmtDate(i.date), date: i.date, score: i.qualityScore, forecast: undefined as number | undefined }));
  if (fc) {
    for (const p of fc.curve.slice(0, 5)) {
      const existing = history.find((h) => h.date === p.date);
      if (existing) existing.forecast = p.score;
      else history.push({ label: fmtDate(p.date), date: p.date, score: undefined as unknown as number, forecast: p.score });
    }
    const last = history.filter((h) => h.score !== undefined).pop();
    if (last && last.forecast === undefined) last.forecast = last.score;
  }

  const ledger = [
    { label: "Arrival quantity", value: inv.arrivalKg, sign: "" },
    { label: "Rejected / culled at inspection", value: -inv.rejectedKg, sign: "−" },
    { label: "Net saleable", value: inv.netKg, sign: "=", strong: true },
    { label: "Allocated to orders (approved)", value: -inv.allocatedKg, sign: "−" },
    { label: "Available to allocate", value: inv.availableKg, sign: "=", strong: true },
  ];

  const applyFlag = () => {
    if (!flagDialog) return;
    if (reason.trim().length < 3) return toast.error("Enter a reason");
    if (flagDialog === "rejected" && allocations.some((a) => a.dispatchStatus !== "planned" && a.dispatchStatus !== "delivered")) return toast.error("Batch has loads in progress — complete or cancel them first.");
    updateBatch(batch.id, { flag: flagDialog, flagReason: reason.trim() });
    toast.success(flagDialog === "on_hold" ? "Batch placed on hold" : "Batch rejected — removed from available inventory");
    setFlagDialog(null);
    setReason("");
  };

  const addTemp = () => {
    const t = Number(temp.tempC);
    if (temp.tempC === "" || Number.isNaN(t) || t < -5 || t > 50) return toast.error("Enter a temperature between −5 and 50°C");
    if (temp.date < batch.arrivalDate || temp.date > state.today) return toast.error("Date must be between arrival and today");
    const log = [...batch.temperatureLog, { date: temp.date, tempC: t, humidityPct: temp.humidity ? Number(temp.humidity) : undefined, source: "manual" as const }].sort((a, b) => a.date.localeCompare(b.date));
    updateBatch(batch.id, { temperatureLog: log });
    toast.success("Temperature reading added — forecast updated");
    setTempOpen(false);
    setTemp({ date: state.today, tempC: "", humidity: "" });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2"><Link to="/app/batches"><ArrowLeft /> All batches</Link></Button>
      <PageHeader
        eyebrow={`${cat.name} · ${batch.variety}`}
        title={batch.code}
        description={<span className="inline-flex flex-wrap items-center gap-2"><ToneBadge tone={BATCH_STATUS[status].tone}>{BATCH_STATUS[status].label}</ToneBadge>{batch.flagReason && <span className="text-amber-700">{batch.flagReason}</span>}{pr && <ToneBadge tone={PRIORITY[pr.level].tone}>Priority #{rank} · {PRIORITY[pr.level].label}</ToneBadge>}</span>}
        actions={
          <>
            {batch.flag === "on_hold" ? (
              <Button variant="outline" onClick={() => { updateBatch(batch.id, { flag: null, flagReason: undefined }); toast.success("Hold released"); }}><PlayCircle /> Release hold</Button>
            ) : !batch.flag ? (
              <>
                <Button variant="outline" onClick={() => setFlagDialog("on_hold")}><PauseCircle /> Place on hold</Button>
                <Button variant="outline" className="text-red-600" onClick={() => setFlagDialog("rejected")}><Ban /> Reject batch</Button>
              </>
            ) : null}
            <Button asChild disabled={!!batch.flag}><Link to={`/app/inspections/new?batch=${batch.id}`}><ClipboardCheck /> Record inspection</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Arrived</div><div className="mt-1 font-display text-xl font-bold">{fmtKg(inv.arrivalKg)}</div><div className="text-xs text-muted-foreground">{fmtDate(batch.arrivalDate, { year: true })} · {diffDays(state.today, batch.arrivalDate)} days ago</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Available to allocate</div><div className="mt-1 font-display text-xl font-bold text-forest-700">{fmtKg(inv.availableKg)}</div><div className="text-xs text-muted-foreground">{fmtKg(inv.onHandKg)} on hand · {fmtKg(inv.dispatchedKg)} dispatched</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Latest inspection</div><div className="mt-1 flex items-center gap-2">{inspections[0] ? <><GradeBadge grade={inspections[0].grade} /><span className="font-display text-xl font-bold">{inspections[0].qualityScore}</span></> : <span className="text-sm text-amber-700">Not inspected</span>}</div><div className="text-xs text-muted-foreground">{inspections[0] ? `${fmtDate(inspections[0].date)} · ${inspections[0].inspector}` : "Record arrival inspection"}</div></Card>
        <Card className="border-dashed border-violet-300 p-4"><div className="flex items-center justify-between text-xs text-violet-700">Predicted grade (3d) <SimulatedTag /></div><div className="mt-1 flex items-center gap-2">{fc ? <><GradeBadge grade={fc.predictedGrade} predicted /><span className="font-display text-xl font-bold">{fc.predictedScore}</span></> : <span className="text-sm text-muted-foreground">—</span>}</div><div className="text-xs text-muted-foreground">{fc ? `Review by ${fmtDate(fc.recommendedReviewDate)}` : "Needs inspection"}</div></Card>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality history ({inspections.length})</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="temperature">Temperature ({batch.temperatureLog.length})</TabsTrigger>
          <TabsTrigger value="allocations">Allocations ({allocations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Batch details</CardTitle></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-3">
                <Stat label="Batch ID" value={batch.code} />
                <Stat label="Produce category" value={cat.name} />
                <Stat label="Variety" value={batch.variety} />
                <Stat label="Supplier / farm" value={<span>{supplier.name}<span className="block text-xs text-muted-foreground">{supplier.kind} · {Math.round(supplier.historicalAcceptRate * 100)}% historical acceptance</span></span>} />
                <Stat label="Origin" value={<span className="inline-flex gap-1"><MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />{batch.origin}</span>} />
                <Stat label="Harvest date" value={fmtDate(batch.harvestDate, { year: true })} />
                <Stat label="Warehouse" value={`${warehouse.name}, ${warehouse.city}`} />
                <Stat label="Storage location" value={batch.storageLocation} />
                <Stat label="Storage type" value={STORAGE[batch.handling.storageType]} />
                <div className="sm:col-span-3"><div className="mb-2 text-xs text-muted-foreground">Handling conditions</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"><Box className="h-3.5 w-3.5" />{PACKAGING[batch.handling.packaging]}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"><Truck className="h-3.5 w-3.5" />{TRANSPORT[batch.handling.transport]} · {batch.handling.transitHours} h</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"><Snowflake className="h-3.5 w-3.5" />{batch.handling.precooled ? "Pre-cooled" : "Not pre-cooled"}</span>
                  </div>
                </div>
                {batch.notes && <div className="sm:col-span-3"><Stat label="Notes" value={batch.notes} /></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Inventory ledger</CardTitle><CardDescription>Exact, integer-kilogram calculation</CardDescription></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {ledger.map((l) => (
                  <div key={l.label} className={`flex items-center justify-between ${l.strong ? "border-t pt-2 font-semibold" : ""}`}>
                    <span className={l.strong ? "" : "text-muted-foreground"}>{l.sign && <span className="mr-1 inline-block w-3 text-center">{l.sign}</span>}{l.label}</span>
                    <span className="tabular-nums">{Math.abs(l.value).toLocaleString()} kg</span>
                  </div>
                ))}
                <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">Of allocated stock, {inv.dispatchedKg.toLocaleString()} kg has left the warehouse; {inv.onHandKg.toLocaleString()} kg remains physically on hand.</div>
                {recs.length > 0 && (
                  <div className="mt-3 rounded-md border border-lime-400 bg-lime-300/20 p-2 text-xs">
                    <div className="font-semibold text-forest-800">{recs.length} pending recommendation{recs.length > 1 ? "s" : ""}</div>
                    {recs.map((r) => <div key={r.key}>{fmtKg(r.qtyKg)} → {orderMap.get(r.orderId)?.customer}</div>)}
                    <Link to="/app/allocation" className="mt-1 inline-block font-medium text-forest-700 underline">Review in allocation</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality">
          {inspections.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No inspections yet" description="Record an arrival inspection to grade this batch and enable forecasting." action={<Button asChild><Link to={`/app/inspections/new?batch=${batch.id}`}>Record inspection</Link></Button>} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Score history</CardTitle><CardDescription>Solid: inspection results · dashed: simulated forecast</CardDescription></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ left: -20, right: 8, top: 6 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis domain={[30, 100]} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <ReferenceArea y1={80} y2={100} fill="#215236" fillOpacity={0.04} />
                      {cat.grades.filter((g) => g.code !== "R").map((g) => <ReferenceLine key={g.code} y={g.minScore} stroke="#b8a77f" strokeDasharray="2 4" label={{ value: g.code, position: "insideLeft", fontSize: 10 }} />)}
                      <Line dataKey="score" name="Inspection score" stroke="#215236" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                      <Line dataKey="forecast" name="Simulated forecast" stroke="#7c3aed" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="space-y-3 lg:col-span-3">
                {inspections.map((i) => (
                  <Card key={i.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <GradeBadge grade={i.grade} />
                      <div className="font-semibold">{INSPECTION_TYPE[i.type]} inspection · {fmtDate(i.date, { weekday: true })}</div>
                      <span className="text-sm text-muted-foreground">by {i.inspector}</span>
                      <span className="ml-auto font-display text-lg font-bold">{i.qualityScore}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                      {cat.criteria.map((c) => <div key={c.key}><span className="text-muted-foreground">{c.label}: </span><span className="font-medium">{i.values[c.key] ?? "—"}{c.type === "score10" ? "/10" : c.unit ? ` ${c.unit}` : ""}</span></div>)}
                      <div><span className="text-muted-foreground">Ripeness: </span><span className="font-medium">{cat.ripenessStages[i.ripenessStage]}</span></div>
                      <div><span className="text-muted-foreground">Pulp temp: </span><span className="font-medium">{i.pulpTempC}°C</span></div>
                    </div>
                    {i.notes && <p className="mt-3 rounded-md bg-muted/50 p-2 text-sm">“{i.notes}”</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {i.rejectedQtyKg > 0 && <ToneBadge tone="danger">{fmtKg(i.rejectedQtyKg)} culled · {i.rejectionReason}</ToneBadge>}
                      {i.documents.map((d) => <span key={d.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5"><FileText className="h-3 w-3" />{d.name}</span>)}
                      {i.photos.length > 0 && <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5"><ImageIcon className="h-3 w-3" />{i.photos.length} photo{i.photos.length > 1 ? "s" : ""}</span>}
                    </div>
                    {i.photos.length > 0 && <div className="mt-2 flex gap-2">{i.photos.map((p) => <img key={p.id} src={p.dataUrl} alt={p.name} className="h-16 w-16 rounded-md object-cover" />)}</div>}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="forecast">
          <Card><CardContent className="pt-5">{fc ? <ForecastSummary fc={fc} cat={cat} /> : <NoForecast />}</CardContent></Card>
        </TabsContent>

        <TabsContent value="temperature">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle>Temperature records</CardTitle><CardDescription>Optimal {cat.optimalTempC[0]}–{cat.optimalTempC[1]}°C · chilling risk below {cat.chillingThresholdC}°C</CardDescription></div>
              <Button size="sm" onClick={() => setTempOpen(true)}><Plus /> Add reading</Button>
            </CardHeader>
            <CardContent>
              {batch.temperatureLog.length === 0 ? (
                <EmptyState icon={Thermometer} title="No temperature records" description="Forecasts assume the storage-type default and confidence is reduced. Add manual readings or connect a logger." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={batch.temperatureLog.map((t) => ({ label: fmtDate(t.date), temp: t.tempC, rh: t.humidityPct }))} margin={{ left: -20, right: 8, top: 6 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 40]} fontSize={11} tickLine={false} axisLine={false} unit="°" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <ReferenceArea y1={cat.optimalTempC[0]} y2={cat.optimalTempC[1]} fill="#a3d12a" fillOpacity={0.18} />
                      <Line dataKey="temp" name="Temperature °C" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations">
          <Card>
            <CardContent className="pt-5">
              {allocations.length === 0 ? <p className="text-sm text-muted-foreground">No approved allocations for this batch.</p> : (
                <div className="space-y-2">
                  {allocations.map((a) => {
                    const o = orderMap.get(a.orderId)!;
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                        <Link to={`/app/orders/${o.id}`} className="font-semibold hover:underline">{o.customer}</Link>
                        <span className="text-muted-foreground">{o.code}</span>
                        <span className="font-medium">{fmtKg(a.qtyKg)}</span>
                        <span className="text-muted-foreground">dispatch {fmtDate(a.plannedDispatchDate)}</span>
                        <span className="ml-auto"><ToneBadge tone={DISPATCH_STATUS[a.dispatchStatus].tone}>{DISPATCH_STATUS[a.dispatchStatus].label}</ToneBadge></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!flagDialog} onOpenChange={(v) => !v && setFlagDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{flagDialog === "on_hold" ? "Place batch on hold" : "Reject batch"}</DialogTitle>
            <DialogDescription>{flagDialog === "on_hold" ? "On-hold batches are excluded from allocation recommendations until released." : "Rejected batches are removed from available inventory. Existing planned allocations remain until cancelled."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="reason">Reason</Label><Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Awaiting residue certificate" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setFlagDialog(null)}>Cancel</Button><Button variant={flagDialog === "rejected" ? "destructive" : "default"} onClick={applyFlag}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tempOpen} onOpenChange={setTempOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add temperature reading</DialogTitle><DialogDescription>Manual readings feed the quality forecast immediately.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" min={batch.arrivalDate} max={state.today} value={temp.date} onChange={(e) => setTemp({ ...temp, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Temperature °C</Label><Input type="number" step={0.1} value={temp.tempC} onChange={(e) => setTemp({ ...temp, tempC: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Humidity %</Label><Input type="number" value={temp.humidity} onChange={(e) => setTemp({ ...temp, humidity: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTempOpen(false)}>Cancel</Button><Button onClick={addTemp}>Add reading</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
