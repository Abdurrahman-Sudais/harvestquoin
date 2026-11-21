import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, ChevronDown, PackageCheck, Truck, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GradeBadge, KpiCard, PageHeader, ScoreBar, SimulatedTag, ToneBadge } from "@/components/shared";
import { useStore } from "@/lib/store";
import { useBatchRows } from "@/hooks/useRows";
import { DISPATCH_STATUS, PRIORITY } from "@/lib/labels";
import { addDays, diffDays, fmtDate, weekdayShort } from "@/lib/dates";
import { fmtKg, cn } from "@/lib/utils";
import { PRIORITY_WEIGHTS } from "@/lib/engine/priority";
import type { DispatchStatus } from "@/lib/types";

const FLOW: DispatchStatus[] = ["planned", "loading", "in_transit", "delivered"];
const NEXT_LABEL: Record<DispatchStatus, string> = { planned: "Start loading", loading: "Mark dispatched", in_transit: "Confirm delivery", delivered: "" };

export default function Dispatch() {
  const { state, derived, setDispatchStatus } = useStore();
  const rows = useBatchRows();
  const [open, setOpen] = useState<string | null>(null);
  const bm = new Map(state.batches.map((b) => [b.id, b]));
  const om = new Map(state.orders.map((o) => [o.id, o]));
  const queue = derived.priority;
  const active = state.allocations.filter((a) => a.dispatchStatus !== "delivered" || (a.deliveredOn && diffDays(state.today, a.deliveredOn) <= 3));
  const days = Array.from({ length: 14 }, (_, i) => addDays(state.today, i - 1));

  const advance = (id: string, cur: DispatchStatus) => {
    const nxt = FLOW[FLOW.indexOf(cur) + 1];
    const r = setDispatchStatus(id, nxt);
    r.ok ? toast.success(`Marked ${DISPATCH_STATUS[nxt].label.toLowerCase()}`) : toast.error(r.error);
  };

  const dueToday = state.allocations.filter((a) => (a.dispatchStatus === "planned" || a.dispatchStatus === "loading") && a.plannedDispatchDate <= state.today);

  return (
    <div>
      <PageHeader eyebrow="Workflow · Step 6" title="Dispatch planning" description="Rank batches by deterioration risk, arrival date, customer acceptance limits, delivery deadlines, quantity and storage conditions — then track every load to delivery." actions={<SimulatedTag />} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Dispatch now" value={queue.filter((q) => q.level === "dispatch_now").length} sub={fmtKg(queue.filter((q) => q.level === "dispatch_now").reduce((s, q) => s + q.onHandKg, 0))} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Dispatch soon / review" value={queue.filter((q) => q.level === "dispatch_soon" || q.level === "review").length} icon={Clock} tone="warning" />
        <KpiCard label="Loads due today" value={dueToday.length} sub={fmtKg(dueToday.reduce((s, a) => s + a.qtyKg, 0))} icon={PackageCheck} tone="lime" />
        <KpiCard label="In transit" value={state.allocations.filter((a) => a.dispatchStatus === "in_transit").length} icon={Truck} />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Priority queue</TabsTrigger>
          <TabsTrigger value="calendar">Dispatch calendar</TabsTrigger>
          <TabsTrigger value="overview">Allocation overview</TabsTrigger>
          <TabsTrigger value="schedule">Delivery schedule</TabsTrigger>
          <TabsTrigger value="tracking">Status tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Priority dispatch queue</CardTitle>
              <CardDescription>Score = {Object.entries(PRIORITY_WEIGHTS).map(([k, w]) => `${Math.round(w * 100)}% ${k}`).join(" + ")}. Click a row for the breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {queue.map((p, i) => {
                const r = rows.find((x) => x.batch.id === p.batchId)!;
                const isOpen = open === p.batchId;
                return (
                  <div key={p.batchId} className={cn("rounded-lg border", p.level === "dispatch_now" && "border-red-200 bg-red-50/30", p.level === "dispatch_soon" && "border-amber-200 bg-amber-50/30")}>
                    <button onClick={() => setOpen(isOpen ? null : p.batchId)} className="flex w-full items-center gap-3 p-3 text-left">
                      <span className="w-6 text-center font-display text-sm font-bold text-muted-foreground">{i + 1}</span>
                      {r.latest ? <GradeBadge grade={r.latest.grade} size="sm" /> : <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-[10px]">?</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{r.batch.code}</span><span className="text-xs text-muted-foreground">{r.batch.variety} · {r.warehouse.city} · {r.batch.storageLocation} · {fmtKg(p.onHandKg)} on hand</span></div>
                        <div className="truncate text-xs text-muted-foreground">{p.reasons[0]}</div>
                      </div>
                      <div className="hidden w-28 md:block"><ScoreBar score={p.score} urgency /></div>
                      <span className="w-8 text-right font-display font-bold">{p.score}</span>
                      <ToneBadge tone={PRIORITY[p.level].tone} className="hidden sm:inline-flex">{PRIORITY[p.level].label}</ToneBadge>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="grid gap-4 border-t p-4 md:grid-cols-2">
                        <div className="space-y-2">
                          {p.components.map((c) => (
                            <div key={c.key} className="text-xs">
                              <div className="flex justify-between"><span className="font-medium">{c.label} <span className="text-muted-foreground">×{c.weight}</span></span><span className="tabular-nums">{Math.round(c.value)} → {Math.round(c.value * c.weight)} pts</span></div>
                              <ScoreBar score={c.value} className="mt-1 h-1.5" urgency />
                              <div className="mt-0.5 text-muted-foreground">{c.detail}</div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 text-sm">
                          <div><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Signals</div><ul className="space-y-1">{p.reasons.map((x) => <li key={x}>• {x}</li>)}</ul></div>
                          {r.fc && <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Inspection</span><GradeBadge grade={r.latest!.grade} size="sm" /><ArrowRight className="h-3 w-3" /><span className="text-muted-foreground">est. today</span><GradeBadge grade={r.fc.predictedGradeToday} size="sm" predicted /><ArrowRight className="h-3 w-3" /><span className="text-muted-foreground">3 days</span><GradeBadge grade={r.fc.predictedGrade} size="sm" predicted /></div>}
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" asChild><Link to={`/app/batches/${r.batch.id}`}>Batch profile</Link></Button>
                            {p.availableKg > 0 && <Button size="sm" asChild><Link to="/app/allocation">Allocate {fmtKg(p.availableKg)}</Link></Button>}
                            <Button size="sm" variant="ghost" asChild><Link to={`/app/assistant?tool=explain_priority&batch=${r.batch.id}`}>Explain with AI</Link></Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Dispatch calendar</CardTitle><CardDescription>Approved loads by planned dispatch date (14 days)</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {days.map((d) => {
                  const loads = state.allocations.filter((a) => a.plannedDispatchDate === d && a.dispatchStatus !== "delivered");
                  const isToday = d === state.today;
                  return (
                    <div key={d} className={cn("min-h-32 rounded-lg border p-2", isToday && "border-forest-600 ring-1 ring-forest-600", d < state.today && "bg-muted/40")}>
                      <div className="mb-2 flex items-baseline justify-between"><span className="text-xs font-semibold">{weekdayShort(d)}</span><span className={cn("font-display text-sm font-bold", isToday && "text-forest-700")}>{fmtDate(d)}</span></div>
                      <div className="space-y-1.5">
                        {loads.map((a) => (
                          <div key={a.id} className={cn("rounded-md px-1.5 py-1 text-[11px] leading-tight", a.dispatchStatus === "in_transit" ? "bg-forest-700 text-white" : a.dispatchStatus === "loading" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900")}>
                            <div className="truncate font-semibold">{om.get(a.orderId)?.customer}</div>
                            <div className="truncate opacity-80">{bm.get(a.batchId)?.code.slice(-7)} · {fmtKg(a.qtyKg)}</div>
                          </div>
                        ))}
                        {loads.length === 0 && <div className="text-[11px] text-muted-foreground">—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-sky-200" /> Planned</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-200" /> Loading</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-forest-700" /> In transit</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Batch allocation overview</CardTitle><CardDescription>How on-hand stock is committed</CardDescription></CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Committed</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="w-48">Commitment</TableHead><TableHead>Orders</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.filter((r) => r.inv.onHandKg > 0 && r.batch.flag !== "rejected").sort((a, b) => b.inv.onHandKg - a.inv.onHandKg).map((r) => {
                  const pending = state.allocations.filter((a) => a.batchId === r.batch.id && (a.dispatchStatus === "planned" || a.dispatchStatus === "loading"));
                  const committed = pending.reduce((s, a) => s + a.qtyKg, 0);
                  return (
                    <TableRow key={r.batch.id}>
                      <TableCell><Link to={`/app/batches/${r.batch.id}`} className="font-medium hover:underline">{r.batch.code}</Link><div className="text-xs text-muted-foreground">{r.batch.variety}</div></TableCell>
                      <TableCell className="text-right tabular-nums">{fmtKg(r.inv.onHandKg)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtKg(committed)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtKg(r.inv.availableKg)}</TableCell>
                      <TableCell><div className="flex h-2 overflow-hidden rounded-full bg-muted"><div className="bg-forest-600" style={{ width: `${(committed / r.inv.onHandKg) * 100}%` }} /></div></TableCell>
                      <TableCell className="text-xs">{pending.map((a) => om.get(a.orderId)?.customer).join(", ") || <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader><CardTitle>Upcoming delivery schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {state.orders.filter((o) => o.deliveryDate >= state.today && o.manualStatus !== "cancelled").sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).map((o) => {
                const al = state.allocations.filter((a) => a.orderId === o.id);
                const kg = al.reduce((s, a) => s + a.qtyKg, 0);
                return (
                  <div key={o.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                    <div className="w-24 shrink-0"><div className="font-display font-bold">{fmtDate(o.deliveryDate)}</div><div className="text-xs text-muted-foreground">{weekdayShort(o.deliveryDate)}</div></div>
                    <div className="min-w-0 flex-1"><Link to={`/app/orders/${o.id}`} className="font-medium hover:underline">{o.customer}</Link><div className="truncate text-xs text-muted-foreground">{o.deliveryLocation}</div></div>
                    <div className="text-sm"><span className="font-semibold">{fmtKg(kg)}</span> <span className="text-muted-foreground">/ {fmtKg(o.requiredQtyKg)}</span></div>
                    <div className="flex flex-wrap gap-1">{al.length ? al.map((a) => <ToneBadge key={a.id} tone={DISPATCH_STATUS[a.dispatchStatus].tone}>{bm.get(a.batchId)?.code.slice(-7)} {DISPATCH_STATUS[a.dispatchStatus].label}</ToneBadge>) : <ToneBadge tone="warning">Unallocated</ToneBadge>}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader><CardTitle>Dispatch status tracking</CardTitle><CardDescription>Advance loads through planned → loading → in transit → delivered</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {active.sort((a, b) => FLOW.indexOf(a.dispatchStatus) - FLOW.indexOf(b.dispatchStatus) || a.plannedDispatchDate.localeCompare(b.plannedDispatchDate)).map((a) => {
                const o = om.get(a.orderId)!;
                const b = bm.get(a.batchId)!;
                const idx = FLOW.indexOf(a.dispatchStatus);
                const late = a.dispatchStatus === "planned" && a.plannedDispatchDate < state.today;
                return (
                  <div key={a.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{o.customer}</span><span className="text-muted-foreground">· {b.code} · {fmtKg(a.qtyKg)} · dispatch {fmtDate(a.plannedDispatchDate)}</span>
                      {late && <ToneBadge tone="danger">Overdue</ToneBadge>}
                      {NEXT_LABEL[a.dispatchStatus] && <Button size="sm" className="ml-auto" onClick={() => advance(a.id, a.dispatchStatus)}>{NEXT_LABEL[a.dispatchStatus]}</Button>}
                    </div>
                    <div className="mt-3 flex items-center">
                      {FLOW.map((s, i) => (
                        <div key={s} className="flex flex-1 items-center last:flex-none">
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn("h-3 w-3 rounded-full border-2", i <= idx ? "border-forest-600 bg-forest-600" : "border-muted-foreground/30 bg-card")} />
                            <span className={cn("text-[10px]", i <= idx ? "font-medium text-forest-800" : "text-muted-foreground")}>{DISPATCH_STATUS[s].label}</span>
                          </div>
                          {i < FLOW.length - 1 && <div className={cn("mx-1 mb-4 h-0.5 flex-1", i < idx ? "bg-forest-600" : "bg-muted")} />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
