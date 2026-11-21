import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Download, FileText, Image as ImageIcon, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GradeBadge, PageHeader, ToneBadge, KpiCard } from "@/components/shared";
import { useStore } from "@/lib/store";
import { useLookups } from "@/hooks/useRows";
import { INSPECTION_TYPE } from "@/lib/labels";
import { addDays, fmtDate } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";
import { exportCSV } from "@/lib/export";
import { AlertTriangle, CalendarClock, Scale } from "lucide-react";

const ALL = "__all";

export default function Inspections() {
  const { state, derived } = useStore();
  const { batch: bm } = useLookups();
  const cat = state.categories[0];
  const [q, setQ] = useState("");
  const [type, setType] = useState(ALL);
  const [inspector, setInspector] = useState(ALL);
  const [grade, setGrade] = useState(ALL);
  const inspectors = [...new Set(state.inspections.map((i) => i.inspector))].sort();

  const list = useMemo(
    () =>
      state.inspections
        .filter((i) => type === ALL || i.type === type)
        .filter((i) => inspector === ALL || i.inspector === inspector)
        .filter((i) => grade === ALL || i.grade === grade)
        .filter((i) => !q || `${bm.get(i.batchId)?.code} ${i.notes}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [state.inspections, type, inspector, grade, q, bm]
  );
  const week = state.inspections.filter((i) => i.date >= addDays(state.today, -6));
  const due = [...derived.forecasts.values()].filter((f) => f.recommendedReviewDate <= state.today && (derived.inventory.get(f.batchId)?.onHandKg ?? 0) > 0);
  const awaiting = state.batches.filter((b) => derived.status.get(b.id) === "awaiting_inspection");

  return (
    <div>
      <PageHeader
        eyebrow="Workflow · Step 2"
        title="Inspection management"
        description={`Record and review inspections against the configurable ${cat.name.toLowerCase()} criteria. Scores and grades are calculated consistently from recorded values.`}
        actions={
          <>
            <Button variant="outline" onClick={() => exportCSV(`harvestquoin-inspections-${state.today}`, ["Date", "Batch", "Type", "Inspector", ...cat.criteria.map((c) => c.label), "Ripeness", "Pulp °C", "Score", "Grade", "Rejected kg", "Reason", "Notes"], list.map((i) => [i.date, bm.get(i.batchId)?.code, INSPECTION_TYPE[i.type], i.inspector, ...cat.criteria.map((c) => i.values[c.key]), cat.ripenessStages[i.ripenessStage], i.pulpTempC, i.qualityScore, i.grade, i.rejectedQtyKg, i.rejectionReason ?? "", i.notes]))}><Download /> Export CSV</Button>
            <Button asChild><Link to="/app/inspections/new"><Plus /> Record inspection</Link></Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Inspections this week" value={week.length} icon={ClipboardCheck} />
        <KpiCard label="Awaiting arrival inspection" value={awaiting.length} sub={awaiting.map((b) => b.code).join(", ") || "None"} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Re-inspection due (forecast)" value={due.length} sub="Recommended review date reached" icon={CalendarClock} tone="lime" />
        <KpiCard label="Culled this week" value={fmtKg(week.reduce((s, i) => s + i.rejectedQtyKg, 0))} icon={Scale} tone="danger" />
      </div>
      {awaiting.length > 0 && (
        <Card className="mb-4 flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div className="flex-1 text-sm"><span className="font-semibold">{awaiting.length} batch{awaiting.length > 1 ? "es" : ""} awaiting arrival inspection.</span> They cannot be forecast or allocated until inspected.</div>
          {awaiting.slice(0, 3).map((b) => <Button key={b.id} size="sm" variant="outline" asChild><Link to={`/app/inspections/new?batch=${b.id}`}>Inspect {b.code}</Link></Button>)}
        </Card>
      )}
      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search batch or notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            <Select value={type} onValueChange={setType}><SelectTrigger className="lg:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All types</SelectItem>{Object.entries(INSPECTION_TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            <Select value={inspector} onValueChange={setInspector}><SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All inspectors</SelectItem>{inspectors.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={grade} onValueChange={setGrade}><SelectTrigger className="lg:w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All grades</SelectItem>{cat.grades.map((g) => <SelectItem key={g.code} value={g.code}>{g.code === "R" ? "Reject" : `Grade ${g.code}`}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead>Inspector</TableHead><TableHead>Damage / decay</TableHead><TableHead>Ripeness</TableHead><TableHead>Score</TableHead><TableHead>Culled</TableHead><TableHead>Records</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.map((i) => {
              const b = bm.get(i.batchId)!;
              return (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(i.date, { year: true })}</TableCell>
                  <TableCell><Link to={`/app/batches/${b.id}`} className="font-medium text-forest-800 hover:underline">{b.code}</Link><div className="text-xs text-muted-foreground">{b.variety}</div></TableCell>
                  <TableCell><ToneBadge tone="secondary">{INSPECTION_TYPE[i.type]}</ToneBadge></TableCell>
                  <TableCell className="whitespace-nowrap">{i.inspector}</TableCell>
                  <TableCell className="tabular-nums">{i.values.damage_pct}% / {i.values.decay_pct}%</TableCell>
                  <TableCell className="whitespace-nowrap">{cat.ripenessStages[i.ripenessStage]}</TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><GradeBadge grade={i.grade} size="sm" /><span className="tabular-nums">{i.qualityScore}</span></div></TableCell>
                  <TableCell className="tabular-nums">{i.rejectedQtyKg ? fmtKg(i.rejectedQtyKg) : "—"}</TableCell>
                  <TableCell><div className="flex gap-2 text-xs text-muted-foreground">{i.documents.length > 0 && <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" />{i.documents.length}</span>}{i.photos.length > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" />{i.photos.length}</span>}</div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
