import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, FlaskConical, TrendingDown, Gauge, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradeBadge, KpiCard, PageHeader, SimulatedTag, ToneBadge } from "@/components/shared";
import { ForecastSummary } from "@/components/shared/ForecastPanel";
import { useStore } from "@/lib/store";
import { ACTIVE_STATUSES, useBatchRows } from "@/hooks/useRows";
import { RISK, TREND } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { fmtKg, cn } from "@/lib/utils";
import { buildFeatureVector } from "@/lib/aws/sagemaker";
import { forecastProvider } from "@/lib/engine/forecast";
import { awsConfig } from "@/lib/aws/config";

const ALL = "__all";
const RISK_ORDER = { critical: 0, high: 1, moderate: 2, low: 3 };

export default function Forecasting() {
  const { state, category } = useStore();
  const rows = useBatchRows().filter((r) => r.fc && ACTIVE_STATUSES.has(r.status) && r.inv.onHandKg > 0);
  const [risk, setRisk] = useState(ALL);
  const list = useMemo(() => rows.filter((r) => risk === ALL || r.fc!.acceptanceRisk === risk).sort((a, b) => RISK_ORDER[a.fc!.acceptanceRisk] - RISK_ORDER[b.fc!.acceptanceRisk] || (a.fc!.daysToAcceptanceLimit ?? 99) - (b.fc!.daysToAcceptanceLimit ?? 99)), [rows, risk]);
  const [sel, setSel] = useState<string | null>(null);
  const current = list.find((r) => r.batch.id === sel) ?? list[0];
  const downgrade = rows.filter((r) => r.fc!.predictedGrade !== r.latest!.grade);
  const features = current ? buildFeatureVector({ batch: current.batch, category: category(current.batch.categoryId), inspections: state.inspections, supplier: current.supplier, asOf: state.today }) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Workflow · Step 3"
        title="AI quality forecasting"
        description="Estimates how commercial produce quality may change based on arrival date, handling, storage conditions, inspection scores, historical batch outcomes and produce category."
        actions={<SimulatedTag />}
      />
      <Card className="mb-6 flex items-start gap-3 border-violet-200 bg-violet-50/60 p-4 text-sm text-violet-900">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <div><span className="font-semibold">Simulated forecasts.</span> These figures come from {forecastProvider.label}, a deterministic demonstration model. Predicted grades are planning estimates — they are not inspection results and not guaranteed shelf-life measurements. Production deployments route through an Amazon SageMaker AI endpoint (<code className="rounded bg-violet-100 px-1 text-xs">{awsConfig.sagemaker.endpointName}</code>).</div>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Batches forecast" value={rows.length} sub={fmtKg(rows.reduce((s, r) => s + r.inv.onHandKg, 0)) + " on hand"} icon={TrendingDown} />
        <KpiCard label="Critical / high risk" value={rows.filter((r) => r.fc!.acceptanceRisk === "critical" || r.fc!.acceptanceRisk === "high").length} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Predicted downgrade (3d)" value={downgrade.length} sub={fmtKg(downgrade.reduce((s, r) => s + r.inv.onHandKg, 0)) + " affected"} icon={TrendingDown} tone="warning" />
        <KpiCard label="Avg. confidence" value={`${Math.round(rows.reduce((s, r) => s + r.fc!.confidence.pct, 0) / Math.max(1, rows.length))}%`} icon={Gauge} tone="lime" />
      </div>
      <div className="grid gap-6 2xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Batch forecasts</CardTitle><CardDescription>Select a batch to see the full forecast</CardDescription></div>
            <Select value={risk} onValueChange={setRisk}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All risk levels</SelectItem>{Object.entries(RISK).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Inspected</TableHead><TableHead>Predicted 3d</TableHead><TableHead>Trend</TableHead><TableHead>Risk</TableHead><TableHead>Conf.</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.batch.id} onClick={() => setSel(r.batch.id)} className={cn("cursor-pointer", current?.batch.id === r.batch.id && "bg-lime-300/20 hover:bg-lime-300/25")}>
                  <TableCell><div className="font-medium">{r.batch.code}</div><div className="text-xs text-muted-foreground">{r.batch.variety} · {r.warehouse.city}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><GradeBadge grade={r.latest!.grade} size="sm" /><span className="text-xs tabular-nums">{r.latest!.qualityScore}</span></div></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><GradeBadge grade={r.fc!.predictedGrade} size="sm" predicted /><span className="text-xs tabular-nums">{r.fc!.predictedScore}</span></div></TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{TREND[r.fc!.trend]}</TableCell>
                  <TableCell><ToneBadge tone={RISK[r.fc!.acceptanceRisk].tone}>{RISK[r.fc!.acceptanceRisk].label}</ToneBadge></TableCell>
                  <TableCell className="text-xs">{r.fc!.confidence.level}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.fc!.recommendedReviewDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        {current && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div><CardTitle><Link to={`/app/batches/${current.batch.id}`} className="hover:underline">{current.batch.code}</Link></CardTitle><CardDescription>{current.batch.variety} · {current.supplier.name} · {current.batch.storageLocation}</CardDescription></div>
                <SimulatedTag />
              </CardHeader>
              <CardContent><ForecastSummary fc={current.fc!} cat={category(current.batch.categoryId)} /></CardContent>
            </Card>
            {features && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4 text-forest-600" /> SageMaker feature vector</CardTitle><CardDescription>Payload the production endpoint will receive for this batch</CardDescription></CardHeader>
                <CardContent><pre className="max-h-64 overflow-auto rounded-lg bg-forest-950 p-3 text-[11px] leading-relaxed text-lime-200 scrollbar-thin">{JSON.stringify(features, null, 2)}</pre></CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
