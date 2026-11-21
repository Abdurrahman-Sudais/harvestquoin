import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, ClipboardCheck, GitMerge, Package, Scale, Truck, TrendingDown, Filter, X, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradeBadge, KpiCard, PageHeader, SimulatedTag, ToneBadge, ScoreBar } from "@/components/shared";
import { useStore } from "@/lib/store";
import { ACTIVE_STATUSES, useBatchRows, useLookups, useOrderRows } from "@/hooks/useRows";
import { BATCH_STATUS, INSPECTION_TYPE, PRIORITY, RISK, DISPATCH_STATUS } from "@/lib/labels";
import { addDays, fmtDate, relDays } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";

const ALL = "__all";

export default function Dashboard() {
  const { state, derived } = useStore();
  const rows = useBatchRows();
  const orders = useOrderRows();
  const { batch: batchMap, order: orderMap } = useLookups();
  const nav = useNavigate();
  const [f, setF] = useState({ cat: ALL, wh: ALL, sup: ALL, status: ALL, from: "", to: "" });
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (f.cat === ALL || r.batch.categoryId === f.cat) &&
          (f.wh === ALL || r.batch.warehouseId === f.wh) &&
          (f.sup === ALL || r.batch.supplierId === f.sup) &&
          (f.status === ALL ? true : r.status === f.status) &&
          (!f.from || r.batch.arrivalDate >= f.from) &&
          (!f.to || r.batch.arrivalDate <= f.to)
      ),
    [rows, f]
  );
  const active = filtered.filter((r) => ACTIVE_STATUSES.has(r.status));
  const ids = new Set(active.map((r) => r.batch.id));
  const availableKg = active.filter((r) => !r.batch.flag).reduce((s, r) => s + r.inv.availableKg, 0);
  const onHandKg = active.reduce((s, r) => s + r.inv.onHandKg, 0);
  const priority = derived.priority.filter((p) => ids.has(p.batchId));
  const urgent = priority.filter((p) => p.level === "dispatch_now" || p.level === "dispatch_soon");
  const awaiting = orders.filter((o) => (f.cat === ALL || o.order.categoryId === f.cat) && (o.prog.status === "awaiting_allocation" || o.prog.status === "partially_allocated"));
  const risks = active.filter((r) => r.fc && (r.fc.acceptanceRisk === "high" || r.fc.acceptanceRisk === "critical"));
  const horizon = addDays(state.today, 7);
  const upcoming = state.allocations
    .filter((a) => (a.dispatchStatus === "planned" || a.dispatchStatus === "loading" || (a.dispatchStatus === "in_transit" && a.dispatchedOn === state.today)) && a.plannedDispatchDate <= horizon && (ids.has(a.batchId) || f.status === ALL))
    .sort((a, b) => a.plannedDispatchDate.localeCompare(b.plannedDispatchDate));
  const nearLimit = active
    .filter((r) => r.fc && r.inv.onHandKg > 0 && r.fc.daysToAcceptanceLimit !== null && r.fc.daysToAcceptanceLimit <= 4)
    .sort((a, b) => (a.fc!.daysToAcceptanceLimit ?? 99) - (b.fc!.daysToAcceptanceLimit ?? 99));
  const inspections = [...state.inspections].filter((i) => filtered.some((r) => r.batch.id === i.batchId)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);

  const byWarehouse = state.warehouses.map((w) => {
    const rs = active.filter((r) => r.batch.warehouseId === w.id);
    const g = (code: string) => rs.filter((r) => (r.latest?.grade ?? "—") === code).reduce((s, r) => s + r.inv.onHandKg, 0);
    return { name: w.city, A: g("A"), B: g("B"), C: g("C"), "Not inspected": rs.filter((r) => !r.latest).reduce((s, r) => s + r.inv.onHandKg, 0) };
  });

  const filtersOn = f.cat !== ALL || f.wh !== ALL || f.sup !== ALL || f.status !== ALL || !!f.from || !!f.to;

  return (
    <div>
      <PageHeader
        eyebrow="Operations overview"
        title="Dashboard"
        description={`Quality-led dispatch picture for ${fmtDate(state.today, { weekday: true, year: true })}.`}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/app/inspections/new"><ClipboardCheck /> Record inspection</Link></Button>
            <Button asChild><Link to="/app/batches?new=1"><Plus /> Register batch</Link></Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-forest-600" /> Filters</div>
          {filtersOn && <Button size="sm" variant="ghost" onClick={() => setF({ cat: ALL, wh: ALL, sup: ALL, status: ALL, from: "", to: "" })}><X /> Clear</Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Produce category</Label>
            <Select value={f.cat} onValueChange={(v) => setF({ ...f, cat: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{state.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Warehouse</Label>
            <Select value={f.wh} onValueChange={(v) => setF({ ...f, wh: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All warehouses</SelectItem>{state.warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Supplier</Label>
            <Select value={f.sup} onValueChange={(v) => setF({ ...f, sup: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All suppliers</SelectItem>{state.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Batch status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{Object.entries(BATCH_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Arrived from</Label><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Arrived to</Label><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active produce batches" value={active.length} sub={`${active.filter((r) => r.status === "awaiting_inspection").length} awaiting inspection`} icon={Package} onClick={() => nav("/app/batches")} />
        <KpiCard label="Available inventory" value={fmtKg(availableKg)} sub={`${fmtKg(onHandKg)} on hand`} icon={Scale} tone="lime" />
        <KpiCard label="Priority dispatch" value={urgent.length} sub={`${priority.filter((p) => p.level === "dispatch_now").length} dispatch now`} icon={AlertTriangle} tone="danger" onClick={() => nav("/app/dispatch")} />
        <KpiCard label="Orders awaiting allocation" value={awaiting.length} sub={`${fmtKg(awaiting.reduce((s, o) => s + o.prog.remainingKg, 0))} unallocated`} icon={GitMerge} tone="warning" onClick={() => nav("/app/allocation")} />
        <KpiCard label="Deterioration risks" value={risks.length} sub="High / critical (simulated)" icon={TrendingDown} tone="danger" onClick={() => nav("/app/forecasting")} />
        <KpiCard label="Upcoming dispatches" value={upcoming.length} sub="Next 7 days" icon={Truck} onClick={() => nav("/app/dispatch")} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Priority queue */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Batches requiring priority dispatch</CardTitle><CardDescription>Ranked by deterioration risk, deadlines and storage conditions</CardDescription></div>
            <SimulatedTag />
          </CardHeader>
          <CardContent className="space-y-2">
            {priority.slice(0, 6).map((p) => {
              const b = batchMap.get(p.batchId)!;
              const r = rows.find((x) => x.batch.id === p.batchId)!;
              return (
                <Link key={p.batchId} to={`/app/batches/${b.id}`} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY[p.level].dot}`} />
                  {r.latest ? <GradeBadge grade={r.latest.grade} size="sm" /> : <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-[10px]">?</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">{b.code}<span className="text-xs font-normal text-muted-foreground">{b.variety} · {r.warehouse.city} · {fmtKg(p.onHandKg)}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{p.reasons[0]}</div>
                  </div>
                  <div className="hidden w-24 sm:block"><ScoreBar score={p.score} urgency /></div>
                  <span className="w-7 text-right font-display text-sm font-bold">{p.score}</span>
                  <ToneBadge tone={PRIORITY[p.level].tone} className="hidden md:inline-flex">{PRIORITY[p.level].label}</ToneBadge>
                </Link>
              );
            })}
            <Button variant="ghost" size="sm" asChild className="mt-1"><Link to="/app/dispatch">Open dispatch planning <ArrowRight /></Link></Button>
          </CardContent>
        </Card>

        {/* Upcoming dispatches */}
        <Card>
          <CardHeader><CardTitle>Upcoming dispatches</CardTitle><CardDescription>Approved allocations, next 7 days</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No dispatches scheduled.</p>}
            {upcoming.slice(0, 6).map((a) => {
              const o = orderMap.get(a.orderId)!;
              const b = batchMap.get(a.batchId)!;
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="w-12 shrink-0 rounded-lg bg-forest-50 py-1 text-center">
                    <div className="text-[10px] uppercase text-forest-600">{fmtDate(a.plannedDispatchDate).split(" ")[1]}</div>
                    <div className="font-display text-lg font-bold leading-none text-forest-900">{fmtDate(a.plannedDispatchDate).split(" ")[0]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{o.customer}</div>
                    <div className="text-xs text-muted-foreground">{b.code} · {fmtKg(a.qtyKg)} · {relDays(a.plannedDispatchDate, state.today)}</div>
                  </div>
                  <ToneBadge tone={DISPATCH_STATUS[a.dispatchStatus].tone}>{DISPATCH_STATUS[a.dispatchStatus].label}</ToneBadge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Inventory approaching acceptance limits</CardTitle><CardDescription>Batches forecast to fall below their current grade within 4 days</CardDescription></div>
            <SimulatedTag />
          </CardHeader>
          <CardContent>
            {nearLimit.length === 0 ? <p className="text-sm text-muted-foreground">No batches near their limits.</p> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3 font-semibold">Batch</th><th className="py-2 pr-3 font-semibold">On hand</th><th className="py-2 pr-3 font-semibold">Inspected</th><th className="py-2 pr-3 font-semibold">Est. today</th><th className="py-2 pr-3 font-semibold">Days to limit</th><th className="py-2 font-semibold">Risk</th></tr></thead>
                  <tbody>
                    {nearLimit.map((r) => (
                      <tr key={r.batch.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 pr-3"><Link to={`/app/batches/${r.batch.id}`} className="font-medium hover:underline">{r.batch.code}</Link><div className="text-xs text-muted-foreground">{r.batch.variety} · {r.batch.storageLocation}</div></td>
                        <td className="py-2.5 pr-3">{fmtKg(r.inv.onHandKg)}</td>
                        <td className="py-2.5 pr-3"><div className="flex items-center gap-1.5"><GradeBadge grade={r.latest!.grade} size="sm" /> <span className="text-xs">{r.latest!.qualityScore}</span></div></td>
                        <td className="py-2.5 pr-3"><div className="flex items-center gap-1.5"><GradeBadge grade={r.fc!.predictedGradeToday} size="sm" predicted /> <span className="text-xs">{r.fc!.estimatedScoreToday}</span></div></td>
                        <td className="py-2.5 pr-3 font-semibold">{r.fc!.daysToAcceptanceLimit === 0 ? "Below limit" : `~${r.fc!.daysToAcceptanceLimit} d`}</td>
                        <td className="py-2.5"><ToneBadge tone={RISK[r.fc!.acceptanceRisk].tone}>{RISK[r.fc!.acceptanceRisk].label}</ToneBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent inspection activity</CardTitle><CardDescription>Latest recorded inspections</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {inspections.map((i) => {
              const b = batchMap.get(i.batchId)!;
              return (
                <Link to={`/app/batches/${b.id}`} key={i.id} className="flex gap-3 rounded-md p-1 hover:bg-muted/40">
                  <GradeBadge grade={i.grade} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm"><span className="font-medium">{b.code}</span> <span className="text-muted-foreground">· {INSPECTION_TYPE[i.type]}</span></div>
                    <div className="text-xs text-muted-foreground">{i.inspector} · {fmtDate(i.date)} · score {i.qualityScore}{i.rejectedQtyKg ? ` · ${fmtKg(i.rejectedQtyKg)} culled` : ""}</div>
                  </div>
                </Link>
              );
            })}
            <Button variant="ghost" size="sm" asChild><Link to="/app/inspections">All inspections <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>On-hand inventory by warehouse & inspection grade</CardTitle><CardDescription>Kilograms physically in storage</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWarehouse} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => `${v / 1000}t`} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => fmtKg(v)} cursor={{ fill: "hsl(var(--muted))" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="A" stackId="a" fill="#215236" name="Grade A" />
                <Bar dataKey="B" stackId="a" fill="#a3d12a" name="Grade B" />
                <Bar dataKey="C" stackId="a" fill="#f59e0b" name="Grade C" />
                <Bar dataKey="Not inspected" stackId="a" fill="#d2c6a9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Orders awaiting allocation</CardTitle><CardDescription>Open orders with unallocated quantity</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {awaiting.slice(0, 6).map(({ order: o, prog }) => (
              <Link to={`/app/orders/${o.id}`} key={o.id} className="block rounded-md p-1 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{o.customer}</span><GradeBadge grade={o.acceptedGrade} size="sm" /></div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span>Due {fmtDate(o.deliveryDate)}</span>·<span>{fmtKg(prog.remainingKg)} of {fmtKg(o.requiredQtyKg)} open</span></div>
                <ScoreBar score={(prog.allocatedKg / o.requiredQtyKg) * 100} className="mt-1.5 h-1.5" />
              </Link>
            ))}
            <Button variant="ghost" size="sm" asChild><Link to="/app/allocation">Review recommendations <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
