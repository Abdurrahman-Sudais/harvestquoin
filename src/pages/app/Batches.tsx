import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Package, Download, Thermometer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, GradeBadge, PageHeader, ToneBadge } from "@/components/shared";
import { BatchFormDialog } from "@/components/shared/BatchFormDialog";
import { useStore } from "@/lib/store";
import { ACTIVE_STATUSES, useBatchRows } from "@/hooks/useRows";
import { BATCH_STATUS, PACKAGING, STORAGE } from "@/lib/labels";
import { fmtDate, diffDays } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";
import { exportCSV } from "@/lib/export";

const ALL = "__all";

export default function Batches() {
  const { state } = useStore();
  const rows = useBatchRows();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [wh, setWh] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [variety, setVariety] = useState(ALL);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    if (params.get("new")) {
      setOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(
    () =>
      rows
        .filter((r) => showClosed || ACTIVE_STATUSES.has(r.status))
        .filter((r) => wh === ALL || r.batch.warehouseId === wh)
        .filter((r) => status === ALL || r.status === status)
        .filter((r) => variety === ALL || r.batch.variety === variety)
        .filter((r) => !q || `${r.batch.code} ${r.supplier.name} ${r.batch.origin} ${r.batch.variety}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.batch.arrivalDate.localeCompare(a.batch.arrivalDate) || b.batch.code.localeCompare(a.batch.code)),
    [rows, q, wh, status, variety, showClosed]
  );

  const doExport = () =>
    exportCSV(
      `harvestquoin-batches-${state.today}`,
      ["Batch ID", "Category", "Variety", "Supplier", "Origin", "Arrival date", "Arrival kg", "Rejected kg", "Allocated kg", "Dispatched kg", "On hand kg", "Available kg", "Warehouse", "Location", "Packaging", "Storage", "Latest score", "Inspection grade", "Status"],
      list.map((r) => [r.batch.code, "Fresh Tomatoes", r.batch.variety, r.supplier.name, r.batch.origin, r.batch.arrivalDate, r.inv.arrivalKg, r.inv.rejectedKg, r.inv.allocatedKg, r.inv.dispatchedKg, r.inv.onHandKg, r.inv.availableKg, r.warehouse.name, r.batch.storageLocation, PACKAGING[r.batch.handling.packaging], STORAGE[r.batch.handling.storageType], r.latest?.qualityScore ?? "", r.latest?.grade ?? "", BATCH_STATUS[r.status].label])
    );

  return (
    <div>
      <PageHeader
        eyebrow="Workflow · Step 1"
        title="Produce batches"
        description="Register and manage every lot with its supplier, handling, storage, inspections and inventory ledger."
        actions={
          <>
            <Button variant="outline" onClick={doExport}><Download /> Export CSV</Button>
            <Button onClick={() => setOpen(true)}><Plus /> Register batch</Button>
          </>
        }
      />
      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search batch ID, supplier, origin, variety…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select value={wh} onValueChange={setWh}><SelectTrigger className="lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All warehouses</SelectItem>{state.warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
            <Select value={variety} onValueChange={setVariety}><SelectTrigger className="lg:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All varieties</SelectItem>{state.categories[0].varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{Object.entries(BATCH_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm"><Checkbox checked={showClosed} onCheckedChange={(v) => setShowClosed(!!v)} /> Show dispatched & rejected</label>
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState icon={Package} title="No batches match" description="Adjust filters or register a new batch." action={<Button onClick={() => setOpen(true)}><Plus /> Register batch</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Supplier / origin</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead className="text-right">Arrived</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Forecast (3d)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => {
                const t = r.batch.temperatureLog[r.batch.temperatureLog.length - 1];
                return (
                  <TableRow key={r.batch.id}>
                    <TableCell><Link to={`/app/batches/${r.batch.id}`} className="font-semibold text-forest-800 hover:underline">{r.batch.code}</Link><div className="text-xs text-muted-foreground">{r.batch.variety}</div></TableCell>
                    <TableCell><div className="max-w-[200px] truncate text-sm">{r.supplier.name}</div><div className="max-w-[200px] truncate text-xs text-muted-foreground">{r.batch.origin}</div></TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.batch.arrivalDate)}<div className="text-xs text-muted-foreground">{diffDays(state.today, r.batch.arrivalDate)}d ago</div></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKg(r.inv.arrivalKg)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtKg(r.inv.availableKg)}<div className="text-xs font-normal text-muted-foreground">{fmtKg(r.inv.onHandKg)} on hand</div></TableCell>
                    <TableCell className="whitespace-nowrap"><div className="text-sm">{r.warehouse.city} · {r.batch.storageLocation}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Thermometer className="h-3 w-3" />{t ? `${t.tempC}°C` : "no log"}</div></TableCell>
                    <TableCell>{r.latest ? <div className="flex items-center gap-1.5"><GradeBadge grade={r.latest.grade} size="sm" /><span className="text-xs tabular-nums">{r.latest.qualityScore}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.fc ? <div className="flex items-center gap-1.5"><GradeBadge grade={r.fc.predictedGrade} size="sm" predicted /><span className="text-xs tabular-nums text-muted-foreground">{r.fc.predictedScore}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell><ToneBadge tone={BATCH_STATUS[r.status].tone}>{BATCH_STATUS[r.status].label}</ToneBadge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{list.length} batches · {fmtKg(list.reduce((s, r) => s + r.inv.availableKg, 0))} available · Dashed grades are simulated forecasts.</div>
        </Card>
      )}
      <BatchFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
