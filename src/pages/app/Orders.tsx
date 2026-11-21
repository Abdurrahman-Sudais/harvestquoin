import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Download, ShoppingCart, CalendarDays, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { GradeBadge, KpiCard, PageHeader, ScoreBar, ToneBadge } from "@/components/shared";
import { OrderFormDialog } from "@/components/shared/OrderFormDialog";
import { useStore } from "@/lib/store";
import { useOrderRows } from "@/hooks/useRows";
import { ORDER_STATUS } from "@/lib/labels";
import { fmtDate, relDays, addDays } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";
import { exportCSV } from "@/lib/export";

const ALL = "__all";

export default function Orders() {
  const { state } = useStore();
  const rows = useOrderRows();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [showPast, setShowPast] = useState(false);
  const list = useMemo(
    () =>
      rows
        .filter((r) => showPast || !["delivered", "cancelled"].includes(r.prog.status))
        .filter((r) => status === ALL || r.prog.status === status)
        .filter((r) => !q || `${r.order.customer} ${r.order.code} ${r.order.deliveryLocation}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (showPast ? b.order.deliveryDate.localeCompare(a.order.deliveryDate) : a.order.deliveryDate.localeCompare(b.order.deliveryDate))),
    [rows, q, status, showPast]
  );
  const open_ = rows.filter((r) => !["delivered", "cancelled"].includes(r.prog.status));

  return (
    <div>
      <PageHeader
        eyebrow="Workflow · Step 4"
        title="Customer orders"
        description="Create and manage buyer orders with accepted grades, quality specifications and delivery deadlines."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCSV(`harvestquoin-orders-${state.today}`, ["Order", "Customer", "Type", "Variety", "Required kg", "Allocated kg", "Remaining kg", "Accepted grade", "Max damage %", "Max decay %", "Delivery date", "Location", "Status"], list.map(({ order: o, prog }) => [o.code, o.customer, o.customerType, o.variety ?? "Any", o.requiredQtyKg, prog.allocatedKg, prog.remainingKg, o.acceptedGrade, o.spec.maxDamagePct, o.spec.maxDecayPct, o.deliveryDate, o.deliveryLocation, ORDER_STATUS[prog.status].label]))}><Download /> Export CSV</Button>
            <Button onClick={() => setOpen(true)}><Plus /> New order</Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Open orders" value={open_.length} icon={ShoppingCart} />
        <KpiCard label="Ordered volume (open)" value={fmtKg(open_.reduce((s, r) => s + r.order.requiredQtyKg, 0))} icon={Scale} tone="lime" />
        <KpiCard label="Unallocated volume" value={fmtKg(open_.reduce((s, r) => s + r.prog.remainingKg, 0))} icon={Scale} tone="warning" />
        <KpiCard label="Due in next 3 days" value={open_.filter((r) => r.order.deliveryDate <= addDays(state.today, 3)).length} icon={CalendarDays} tone="danger" />
      </div>
      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search customer, order ID, location…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="lg:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{Object.entries(ORDER_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm"><Checkbox checked={showPast} onCheckedChange={(v) => setShowPast(!!v)} /> Show delivered & cancelled</label>
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Grade</TableHead><TableHead>Specification</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="w-40">Allocation</TableHead><TableHead>Delivery</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.map(({ order: o, prog }) => (
              <TableRow key={o.id}>
                <TableCell><Link to={`/app/orders/${o.id}`} className="font-semibold text-forest-800 hover:underline">{o.code}</Link></TableCell>
                <TableCell><div className="font-medium">{o.customer}</div><div className="text-xs text-muted-foreground">{o.customerType}{o.variety ? ` · ${o.variety} only` : ""}</div></TableCell>
                <TableCell><GradeBadge grade={o.acceptedGrade} size="sm" /></TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">≤{o.spec.maxDamagePct}% dmg · ≤{o.spec.maxDecayPct}% decay{o.spec.minFirmness ? ` · firm ≥${o.spec.minFirmness}` : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKg(o.requiredQtyKg)}</TableCell>
                <TableCell><ScoreBar score={(prog.allocatedKg / o.requiredQtyKg) * 100} className="h-1.5" /><div className="mt-1 text-[11px] text-muted-foreground">{fmtKg(prog.allocatedKg)} allocated{prog.remainingKg ? ` · ${fmtKg(prog.remainingKg)} open` : ""}</div></TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(o.deliveryDate)}<div className="text-xs text-muted-foreground">{relDays(o.deliveryDate, state.today)}</div></TableCell>
                <TableCell><ToneBadge tone={ORDER_STATUS[prog.status].tone}>{ORDER_STATUS[prog.status].label}</ToneBadge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <OrderFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
