import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Download, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SimulatedTag } from "@/components/shared";
import { useStore } from "@/lib/store";
import { useBatchRows, useOrderRows, ACTIVE_STATUSES } from "@/hooks/useRows";
import { addDays, diffDays, fmtDate } from "@/lib/dates";
import { fmtKg, cn } from "@/lib/utils";
import { exportCSV, exportPDF, type Cell as XCell } from "@/lib/export";
import { ORDER_STATUS, RISK } from "@/lib/labels";

const COLORS = ["#215236", "#a3d12a", "#f59e0b", "#5c9d71", "#b8a77f", "#0ea5e9", "#dc2626", "#7c3aed"];
const DISCLAIMER = "Figures marked as predicted are simulated forecasts from HarvestQuoin's demonstration model. They are planning estimates, not inspection results or guaranteed shelf-life measurements.";

interface Report {
  key: string;
  title: string;
  description: string;
  simulated?: boolean;
  headers: string[];
  rows: XCell[][];
  chart: ReactNode;
  summary?: { label: string; value: string }[];
}

export default function Reports() {
  const { state } = useStore();
  const rows = useBatchRows();
  const orders = useOrderRows();
  const [active, setActive] = useState("quality");

  const reports = useMemo<Report[]>(() => {
    const today = state.today;
    const bm = new Map(state.batches.map((b) => [b.id, b]));
    const om = new Map(state.orders.map((o) => [o.id, o]));
    const activeRows = rows.filter((r) => ACTIVE_STATUSES.has(r.status) && r.inv.onHandKg > 0);

    // 1. Quality trends — weekly average inspection score & grade mix (last 5 weeks)
    const weeks = Array.from({ length: 5 }, (_, i) => addDays(today, -7 * (4 - i) - 6));
    const trend = weeks.map((start) => {
      const end = addDays(start, 6);
      const ins = state.inspections.filter((i) => i.date >= start && i.date <= end);
      const avg = ins.length ? Math.round((ins.reduce((s, i) => s + i.qualityScore, 0) / ins.length) * 10) / 10 : null;
      return { week: fmtDate(start), avg, A: ins.filter((i) => i.grade === "A").length, B: ins.filter((i) => i.grade === "B").length, C: ins.filter((i) => i.grade === "C").length, R: ins.filter((i) => i.grade === "R").length, n: ins.length };
    });
    const qualityRows = state.batches
      .map((b) => {
        const ins = state.inspections.filter((i) => i.batchId === b.id).sort((x, y) => x.date.localeCompare(y.date));
        if (!ins.length) return null;
        const f = ins[0], l = ins[ins.length - 1];
        return [b.code, b.variety, state.suppliers.find((s) => s.id === b.supplierId)?.name, ins.length, f.qualityScore, f.grade, l.qualityScore, l.grade, Math.round((l.qualityScore - f.qualityScore) * 10) / 10, l.date] as XCell[];
      })
      .filter(Boolean) as XCell[][];

    // 2. Inventory distribution
    const byWh = state.warehouses.map((w) => ({ name: w.city, value: activeRows.filter((r) => r.batch.warehouseId === w.id).reduce((s, r) => s + r.inv.onHandKg, 0) }));
    const byVariety = state.categories[0].varieties.map((v) => ({ name: v, value: activeRows.filter((r) => r.batch.variety === v).reduce((s, r) => s + r.inv.onHandKg, 0) })).filter((x) => x.value > 0);

    // 3. Predicted changes
    const pred = activeRows.filter((r) => r.fc).map((r) => ({ r, change: Math.round((r.fc!.predictedScore - r.latest!.qualityScore) * 10) / 10 })).sort((a, b) => a.change - b.change);

    // 4. Order allocation
    const ordActive = orders.filter((o) => o.order.manualStatus !== "cancelled" && o.order.deliveryDate >= addDays(today, -1));

    // 5. Dispatch performance
    const delivered = state.allocations.filter((a) => a.dispatchStatus === "delivered");
    const onTime = delivered.filter((a) => a.deliveredOn && a.deliveredOn <= om.get(a.orderId)!.deliveryDate);
    const deliveredKg = delivered.reduce((s, a) => s + a.qtyKg, 0);
    const rejKg = delivered.reduce((s, a) => s + (a.rejectedOnDeliveryKg ?? 0), 0);
    const perfByWeek = weeks.map((start) => {
      const end = addDays(start, 6);
      const d = delivered.filter((a) => a.deliveredOn && a.deliveredOn >= start && a.deliveredOn <= end);
      const kg = d.reduce((s, a) => s + a.qtyKg, 0);
      const rj = d.reduce((s, a) => s + (a.rejectedOnDeliveryKg ?? 0), 0);
      return { week: fmtDate(start), delivered: kg, accepted: kg - rj, rejected: rj };
    });

    // 6. Rejections
    const rej: XCell[][] = [];
    for (const i of state.inspections.filter((x) => x.rejectedQtyKg > 0)) rej.push([i.date, bm.get(i.batchId)?.code, "Inspection cull", i.rejectedQtyKg, i.rejectionReason ?? "", i.inspector]);
    for (const a of state.allocations.filter((x) => (x.rejectedOnDeliveryKg ?? 0) > 0)) rej.push([a.deliveredOn, bm.get(a.batchId)?.code, `Buyer rejection (${om.get(a.orderId)?.customer})`, a.rejectedOnDeliveryKg, a.outcome === "rejected" ? "Load rejected below spec" : "Partial rejection on delivery", "Buyer QC"]);
    rej.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    const rejBySource = [
      { name: "Inspection culls", value: state.inspections.reduce((s, i) => s + i.rejectedQtyKg, 0) },
      { name: "Buyer rejections", value: rejKg },
    ];

    // 7. Near-limit
    const near = activeRows.filter((r) => r.fc && r.fc.daysToAcceptanceLimit !== null && r.fc.daysToAcceptanceLimit <= 5).sort((a, b) => a.fc!.daysToAcceptanceLimit! - b.fc!.daysToAcceptanceLimit!);

    const tt = { contentStyle: { fontSize: 12, borderRadius: 8 } };
    return [
      {
        key: "quality", title: "Batch quality trends", description: "Inspection scores and grade mix over the last five weeks (actual inspection results).",
        headers: ["Batch", "Variety", "Supplier", "Inspections", "First score", "First grade", "Latest score", "Latest grade", "Change", "Latest date"], rows: qualityRows,
        summary: [{ label: "Inspections (5 wks)", value: String(trend.reduce((s, t) => s + t.n, 0)) }, { label: "Avg score (latest wk)", value: String(trend[4].avg ?? "—") }],
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} /><YAxis yAxisId="l" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} /><YAxis yAxisId="r" orientation="right" domain={[40, 100]} fontSize={11} tickLine={false} axisLine={false} /><Tooltip {...tt} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar yAxisId="l" dataKey="A" stackId="g" fill="#215236" name="Grade A" /><Bar yAxisId="l" dataKey="B" stackId="g" fill="#a3d12a" name="Grade B" /><Bar yAxisId="l" dataKey="C" stackId="g" fill="#f59e0b" name="Grade C" /><Bar yAxisId="l" dataKey="R" stackId="g" fill="#dc2626" name="Reject" radius={[4, 4, 0, 0]} />
              <Line yAxisId="r" dataKey="avg" stroke="#7c3aed" name="Avg score" />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        key: "inventory", title: "Inventory distribution", description: "On-hand inventory by warehouse and variety.",
        headers: ["Batch", "Variety", "Warehouse", "Location", "Supplier", "On hand kg", "Available kg", "Grade"],
        rows: activeRows.map((r) => [r.batch.code, r.batch.variety, r.warehouse.name, r.batch.storageLocation, r.supplier.name, r.inv.onHandKg, r.inv.availableKg, r.latest?.grade ?? "Not inspected"]),
        summary: [{ label: "On hand", value: fmtKg(activeRows.reduce((s, r) => s + r.inv.onHandKg, 0)) }, { label: "Available", value: fmtKg(activeRows.reduce((s, r) => s + r.inv.availableKg, 0)) }],
        chart: (
          <div className="grid h-full grid-cols-2">
            {[byWh, byVariety].map((d, k) => (
              <ResponsiveContainer key={k} width="100%" height="100%">
                <PieChart><Pie data={d} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>{d.map((_, i) => <Cell key={i} fill={COLORS[(i + k * 3) % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => fmtKg(v)} {...tt} /><Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" /></PieChart>
              </ResponsiveContainer>
            ))}
          </div>
        ),
      },
      {
        key: "predicted", title: "Predicted quality changes", description: "Inspection score vs simulated 3-day predicted score for every batch on hand.", simulated: true,
        headers: ["Batch", "Variety", "Inspection grade", "Inspection score", "Inspected on", "Predicted grade (3d)", "Predicted score (3d)", "Change", "Trend", "Confidence"],
        rows: pred.map(({ r, change }) => [r.batch.code, r.batch.variety, r.latest!.grade, r.latest!.qualityScore, r.latest!.date, r.fc!.predictedGrade, r.fc!.predictedScore, change, r.fc!.trend.replace("_", " "), `${r.fc!.confidence.level} (${r.fc!.confidence.pct}%)`]),
        summary: [{ label: "Predicted downgrades", value: String(pred.filter((p) => p.r.fc!.predictedGrade !== p.r.latest!.grade).length) }],
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pred.map(({ r, change }) => ({ name: r.batch.code.slice(-7), change }))} layout="vertical" margin={{ left: 10 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" fontSize={11} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" fontSize={10} width={60} tickLine={false} axisLine={false} /><Tooltip {...tt} /><ReferenceLine x={0} stroke="#999" />
              <Bar dataKey="change" name="Predicted change (pts)" radius={[0, 4, 4, 0]}>{pred.map((p, i) => <Cell key={i} fill={p.change < -15 ? "#dc2626" : p.change < -5 ? "#f59e0b" : "#5c9d71"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        key: "orders", title: "Customer order allocation", description: "Fill rate of open and recent orders.",
        headers: ["Order", "Customer", "Grade", "Required kg", "Allocated kg", "Remaining kg", "Fill %", "Delivery", "Status"],
        rows: ordActive.map(({ order: o, prog }) => [o.code, o.customer, o.acceptedGrade, o.requiredQtyKg, prog.allocatedKg, prog.remainingKg, Math.round((prog.allocatedKg / o.requiredQtyKg) * 100), o.deliveryDate, ORDER_STATUS[prog.status].label]),
        summary: [{ label: "Overall fill", value: `${Math.round((ordActive.reduce((s, o) => s + o.prog.allocatedKg, 0) / Math.max(1, ordActive.reduce((s, o) => s + o.order.requiredQtyKg, 0))) * 100)}%` }],
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordActive.map(({ order: o, prog }) => ({ name: o.customer.split(" ")[0], allocated: prog.allocatedKg, remaining: prog.remainingKg }))}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}t`} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => fmtKg(v)} {...tt} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="allocated" stackId="o" fill="#215236" name="Allocated" /><Bar dataKey="remaining" stackId="o" fill="#e6dfcd" name="Remaining" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        key: "dispatch", title: "Dispatch performance", description: "Delivered loads, on-time rate and buyer acceptance.",
        headers: ["Order", "Customer", "Batch", "Qty kg", "Planned dispatch", "Dispatched", "Delivered", "Due", "On time", "Outcome", "Rejected kg"],
        rows: delivered.map((a) => { const o = om.get(a.orderId)!; return [o.code, o.customer, bm.get(a.batchId)?.code, a.qtyKg, a.plannedDispatchDate, a.dispatchedOn, a.deliveredOn, o.deliveryDate, a.deliveredOn && a.deliveredOn <= o.deliveryDate ? "Yes" : "No", a.outcome ?? "", a.rejectedOnDeliveryKg ?? 0]; }),
        summary: [{ label: "On-time delivery", value: `${Math.round((onTime.length / Math.max(1, delivered.length)) * 100)}%` }, { label: "Buyer acceptance (kg)", value: `${Math.round(((deliveredKg - rejKg) / Math.max(1, deliveredKg)) * 1000) / 10}%` }, { label: "Delivered", value: fmtKg(deliveredKg) }],
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perfByWeek}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}t`} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => fmtKg(v)} {...tt} /><Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Area dataKey="accepted" stackId="d" stroke="#215236" fill="#215236" fillOpacity={0.7} name="Accepted" /><Area dataKey="rejected" stackId="d" stroke="#dc2626" fill="#dc2626" fillOpacity={0.6} name="Rejected by buyer" />
            </AreaChart>
          </ResponsiveContainer>
        ),
      },
      {
        key: "rejections", title: "Batch rejection records", description: "Fruit culled at inspection and quantities rejected by buyers.",
        headers: ["Date", "Batch", "Source", "Qty kg", "Reason", "Recorded by"], rows: rej,
        summary: rejBySource.map((r) => ({ label: r.name, value: fmtKg(r.value) })),
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rejBySource} layout="vertical" margin={{ left: 30 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" fontSize={11} tickFormatter={(v) => fmtKg(v)} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" fontSize={11} width={110} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => fmtKg(v)} {...tt} />
              <Bar dataKey="value" name="Rejected" radius={[0, 4, 4, 0]}>{rejBySource.map((_, i) => <Cell key={i} fill={i ? "#dc2626" : "#f59e0b"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ),
      },
      {
        key: "limits", title: "Inventory approaching acceptance limits", description: "Batches forecast to fall below their current inspection grade within 5 days.", simulated: true,
        headers: ["Batch", "Variety", "Location", "On hand kg", "Inspection grade", "Est. score today", "Days to limit", "Risk", "Review by"],
        rows: near.map((r) => [r.batch.code, r.batch.variety, `${r.warehouse.city} · ${r.batch.storageLocation}`, r.inv.onHandKg, r.latest!.grade, r.fc!.estimatedScoreToday, r.fc!.daysToAcceptanceLimit, RISK[r.fc!.acceptanceRisk].label, r.fc!.recommendedReviewDate]),
        summary: [{ label: "Batches", value: String(near.length) }, { label: "Volume at risk", value: fmtKg(near.reduce((s, r) => s + r.inv.onHandKg, 0)) }],
        chart: (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ right: 12 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="day" type="number" domain={[0, 7]} fontSize={11} tickFormatter={(d) => `+${d}d`} tickLine={false} axisLine={false} allowDuplicatedCategory={false} /><YAxis domain={[30, 100]} fontSize={11} tickLine={false} axisLine={false} /><Tooltip {...tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
              {near.slice(0, 6).map((r, i) => <Line key={r.batch.id} data={r.fc!.curve} dataKey="score" name={r.batch.code.slice(-7)} stroke={COLORS[i]} strokeDasharray="5 3" dot={false} />)}
              <ReferenceLine y={65} stroke="#b8a77f" strokeDasharray="2 4" /><ReferenceLine y={80} stroke="#b8a77f" strokeDasharray="2 4" />
            </LineChart>
          </ResponsiveContainer>
        ),
      },
    ];
  }, [state, rows, orders]);

  const cur = reports.find((r) => r.key === active)!;
  const csv = (r: Report) => exportCSV(`harvestquoin-${r.key}-${state.today}`, r.headers, r.rows);
  const pdf = (list: Report[], name: string, title: string) => {
    try {
      exportPDF(`harvestquoin-${name}-${state.today}`, title, `Operating date ${fmtDate(state.today, { year: true })} · ${state.categories[0].name}`, list.map((r) => ({ title: r.title + (r.simulated ? " (simulated forecast)" : ""), note: r.description, headers: r.headers, rows: r.rows })), list.some((r) => r.simulated) ? DISCLAIMER : undefined);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("PDF export failed");
      console.error(e);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Intelligence" title="Reports & analytics" description="Quality, inventory, forecasts, allocation, dispatch and rejection reporting with PDF and CSV exports." actions={<Button onClick={() => pdf(reports, "full-report", "Operations report")}><FileText /> Export all (PDF)</Button>} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-2">
          {reports.map((r) => (
            <button key={r.key} onClick={() => setActive(r.key)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm", active === r.key ? "bg-forest-50 font-semibold text-forest-900" : "text-muted-foreground hover:bg-muted/50")}>
              <BarChart3 className="h-4 w-4 shrink-0" /> <span className="flex-1">{r.title}</span>
            </button>
          ))}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="flex items-center gap-2">{cur.title}{cur.simulated && <SimulatedTag />}</CardTitle><CardDescription className="mt-1">{cur.description}</CardDescription></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => csv(cur)}><Download /> CSV</Button><Button size="sm" variant="outline" onClick={() => pdf([cur], cur.key, cur.title)}><FileText /> PDF</Button></div>
            </CardHeader>
            <CardContent>
              {cur.summary && <div className="mb-4 flex flex-wrap gap-3">{cur.summary.map((s) => <div key={s.label} className="rounded-lg border bg-muted/30 px-3 py-2"><div className="text-xs text-muted-foreground">{s.label}</div><div className="font-display text-lg font-bold">{s.value}</div></div>)}</div>}
              <div className="h-72">{cur.chart}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Data · {cur.rows.length} rows</CardTitle></CardHeader>
            <div className="max-h-[480px] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow>{cur.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {cur.rows.length === 0 && <TableRow><TableCell colSpan={cur.headers.length} className="py-8 text-center text-muted-foreground">No records</TableCell></TableRow>}
                  {cur.rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="whitespace-nowrap text-xs">{typeof c === "number" ? c.toLocaleString() : (c ?? "—")}</TableCell>)}</TableRow>)}
                </TableBody>
              </Table>
            </div>
          </Card>
          {cur.simulated && <p className="text-xs text-violet-700">{DISCLAIMER}</p>}
          <p className="text-xs text-muted-foreground">Generated {diffDays(state.today, state.today) === 0 ? "for" : ""} operating date {fmtDate(state.today, { year: true })}.</p>
        </div>
      </div>
    </div>
  );
}
