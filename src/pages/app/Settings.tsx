import { useState } from "react";
import { toast } from "sonner";
import { Cloud, Save, RotateCcw, Warehouse as WarehouseIcon, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GradeBadge, PageHeader, ToneBadge } from "@/components/shared";
import { useStore } from "@/lib/store";
import { AWS_SERVICES, awsConfig } from "@/lib/aws/config";
import { TOMATO } from "@/lib/seed";
import type { ProduceCategory } from "@/lib/types";

export default function Settings() {
  const { state, updateCategory, resetDemo } = useStore();
  const [cat, setCat] = useState<ProduceCategory>(() => structuredClone(state.categories[0]));
  const ordered = [...cat.grades].filter((g) => g.code !== "R").map((g) => g.minScore);
  const valid = ordered.every((v, i) => i === 0 || v < ordered[i - 1]) && ordered.every((v) => v > 0 && v <= 100) && cat.criteria.some((c) => c.weight > 0);

  const save = () => {
    if (!valid) return toast.error("Grade thresholds must be descending (A > B > C) between 1 and 100, and at least one criterion must have weight.");
    updateCategory(cat);
    toast.success("Grading configuration saved", { description: "New inspections use the updated criteria. Existing inspection results are unchanged." });
  };

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Settings & AWS architecture" description="Configure commercial grading and inspection criteria, and review how HarvestQuoin maps onto AWS services." />
      <Tabs defaultValue="grading">
        <TabsList>
          <TabsTrigger value="grading">Grading & criteria</TabsTrigger>
          <TabsTrigger value="network">Warehouses & suppliers</TabsTrigger>
          <TabsTrigger value="aws">AWS architecture</TabsTrigger>
          <TabsTrigger value="demo">Demo data</TabsTrigger>
        </TabsList>

        <TabsContent value="grading" className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div><CardTitle>{cat.name} — commercial grades</CardTitle><CardDescription>Minimum composite score per grade, and hard limits that cap grades regardless of score.</CardDescription></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setCat(structuredClone(TOMATO))}><RotateCcw /> Defaults</Button><Button size="sm" onClick={save}><Save /> Save</Button></div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {cat.grades.filter((g) => g.code !== "R").map((g, i) => (
                <div key={g.code} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2"><GradeBadge grade={g.code} size="sm" /><span className="font-medium">{g.label}</span></div>
                  <Label className="mt-3 block text-xs text-muted-foreground">Minimum score</Label>
                  <Input type="number" min={1} max={100} value={g.minScore} onChange={(e) => { const grades = [...cat.grades]; grades[i] = { ...g, minScore: Number(e.target.value) }; setCat({ ...cat, grades }); }} className="mt-1" />
                  <p className="mt-2 text-xs text-muted-foreground">{g.description}</p>
                </div>
              ))}
              <div className="grid gap-3 rounded-lg border p-3 md:col-span-3 md:grid-cols-3">
                <div><Label className="text-xs">Max damage % for Grade A</Label><Input type="number" className="mt-1" value={cat.hardLimits.maxDamagePctForA} onChange={(e) => setCat({ ...cat, hardLimits: { ...cat.hardLimits, maxDamagePctForA: Number(e.target.value) } })} /></div>
                <div><Label className="text-xs">Max decay % for Grade B</Label><Input type="number" className="mt-1" value={cat.hardLimits.maxDecayPctForB} onChange={(e) => setCat({ ...cat, hardLimits: { ...cat.hardLimits, maxDecayPctForB: Number(e.target.value) } })} /></div>
                <div><Label className="text-xs">Max decay % commercially acceptable</Label><Input type="number" className="mt-1" value={cat.hardLimits.maxDecayPctCommercial} onChange={(e) => setCat({ ...cat, hardLimits: { ...cat.hardLimits, maxDecayPctCommercial: Number(e.target.value) } })} /></div>
              </div>
              {!valid && <p className="text-sm text-red-600 md:col-span-3">Thresholds must descend from A to C.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Inspection criteria</CardTitle><CardDescription>Weights determine each criterion's contribution to the composite score. Set weight 0 to record without scoring.</CardDescription></CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Criterion</TableHead><TableHead>Group</TableHead><TableHead>Scale</TableHead><TableHead>Direction</TableHead><TableHead className="w-28">Weight</TableHead><TableHead>Required</TableHead></TableRow></TableHeader>
              <TableBody>
                {cat.criteria.map((c, i) => (
                  <TableRow key={c.key}>
                    <TableCell className="font-medium">{c.label}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{c.group}</TableCell>
                    <TableCell className="text-xs">{c.type === "score10" ? "1–10 score" : `${c.min}–${c.max} ${c.unit ?? ""}`}{c.ideal ? ` (ideal ${c.ideal[0]}–${c.ideal[1]})` : ""}</TableCell>
                    <TableCell className="text-xs">{c.ideal ? "Within range" : c.higherIsBetter ? "Higher is better" : "Lower is better"}</TableCell>
                    <TableCell><Input type="number" step={0.1} min={0} max={5} value={c.weight} onChange={(e) => { const criteria = [...cat.criteria]; criteria[i] = { ...c, weight: Math.max(0, Number(e.target.value)) }; setCat({ ...cat, criteria }); }} className="h-8" /></TableCell>
                    <TableCell><input type="checkbox" checked={c.required} onChange={(e) => { const criteria = [...cat.criteria]; criteria[i] = { ...c, required: e.target.checked }; setCat({ ...cat, criteria }); }} className="h-4 w-4 accent-forest-700" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card>
            <CardHeader><CardTitle>Forecast simulation parameters</CardTitle><CardDescription>Used by the simulated forecast model until a SageMaker endpoint is connected.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div><Label className="text-xs">Base decay (pts/day)</Label><Input type="number" step={0.1} className="mt-1" value={cat.baseDecayPerDay} onChange={(e) => setCat({ ...cat, baseDecayPerDay: Math.max(0.05, Number(e.target.value)) })} /></div>
              <div><Label className="text-xs">Optimal temp min °C</Label><Input type="number" className="mt-1" value={cat.optimalTempC[0]} onChange={(e) => setCat({ ...cat, optimalTempC: [Number(e.target.value), cat.optimalTempC[1]] })} /></div>
              <div><Label className="text-xs">Optimal temp max °C</Label><Input type="number" className="mt-1" value={cat.optimalTempC[1]} onChange={(e) => setCat({ ...cat, optimalTempC: [cat.optimalTempC[0], Number(e.target.value)] })} /></div>
              <div><Label className="text-xs">Chilling threshold °C</Label><Input type="number" className="mt-1" value={cat.chillingThresholdC} onChange={(e) => setCat({ ...cat, chillingThresholdC: Number(e.target.value) })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><WarehouseIcon className="h-4 w-4" /> Warehouses</CardTitle></CardHeader>
            <CardContent className="space-y-3">{state.warehouses.map((w) => <div key={w.id} className="rounded-lg border p-3"><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.city}</div><div className="mt-2 flex flex-wrap gap-1">{w.locations.map((l) => <span key={l} className="rounded bg-muted px-2 py-0.5 text-xs">{l}</span>)}</div></div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Suppliers</CardTitle><CardDescription>Historical outcomes feed the forecast</CardDescription></CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>State</TableHead><TableHead className="text-right">Batches</TableHead><TableHead className="text-right">Accepted</TableHead><TableHead className="text-right">Decay factor</TableHead></TableRow></TableHeader>
              <TableBody>{state.suppliers.map((s) => <TableRow key={s.id}><TableCell><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.kind}</div></TableCell><TableCell>{s.state}</TableCell><TableCell className="text-right">{s.batchesDelivered}</TableCell><TableCell className="text-right">{Math.round(s.historicalAcceptRate * 100)}%</TableCell><TableCell className="text-right font-mono text-xs">×{s.historicalDecayFactor.toFixed(2)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="aws" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-4 w-4 text-forest-600" /> Target AWS architecture</CardTitle><CardDescription>Mode: <span className="font-mono">{awsConfig.mode}</span> · Region: <span className="font-mono">{awsConfig.region}</span></CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto scrollbar-thin">
                <svg viewBox="0 0 900 330" className="min-w-[720px]" role="img" aria-label="AWS architecture diagram">
                  <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5c9d71" /></marker></defs>
                  {[
                    { x: 20, y: 135, w: 150, t: "HarvestQuoin web", s: "React · Vite" },
                    { x: 220, y: 40, w: 150, t: "Amazon Cognito", s: "Authentication" },
                    { x: 220, y: 135, w: 150, t: "API Gateway", s: "REST / HTTPS" },
                    { x: 420, y: 135, w: 160, t: "AWS Lambda", s: "Allocation & processing" },
                    { x: 640, y: 20, w: 220, t: "Amazon SageMaker AI", s: "Quality forecasting endpoint" },
                    { x: 640, y: 100, w: 220, t: "Amazon Bedrock", s: "Note normalisation & summaries" },
                    { x: 640, y: 180, w: 220, t: "Amazon DynamoDB", s: "Batches · orders · inventory ledger" },
                    { x: 640, y: 260, w: 220, t: "Amazon S3", s: "Datasets · photos · documents" },
                    { x: 420, y: 260, w: 160, t: "Amazon CloudWatch", s: "Logs · metrics · alarms" },
                  ].map((n) => (
                    <g key={n.t}>
                      <rect x={n.x} y={n.y} width={n.w} height="54" rx="10" fill="#f0f7f1" stroke="#8ebf9c" />
                      <text x={n.x + n.w / 2} y={n.y + 24} textAnchor="middle" fontSize="13" fontWeight="700" fill="#163626">{n.t}</text>
                      <text x={n.x + n.w / 2} y={n.y + 41} textAnchor="middle" fontSize="10.5" fill="#5d513b">{n.s}</text>
                    </g>
                  ))}
                  {[[170, 162, 220, 162], [170, 150, 220, 75], [370, 162, 420, 162], [580, 150, 640, 47], [580, 156, 640, 127], [580, 168, 640, 207], [580, 175, 640, 287], [500, 189, 500, 260]].map(([x1, y1, x2, y2], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c9d71" strokeWidth="1.6" markerEnd="url(#arr)" />
                  ))}
                </svg>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {AWS_SERVICES.map((s) => (
              <Card key={s.key} className="p-4">
                <div className="flex items-start justify-between gap-2"><div className="font-semibold">{s.service}</div><ToneBadge tone={s.status === "simulated" ? "ai" : "secondary"}>{s.status === "simulated" ? "Simulated in demo" : "Adapter prepared"}</ToneBadge></div>
                <div className="mt-0.5 text-sm text-forest-700">{s.role}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="demo">
          <Card>
            <CardHeader><CardTitle>Demo data</CardTitle><CardDescription>All data lives in this browser. Resetting rebuilds the demonstration dataset relative to today's date.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-lg border px-3 py-2">{state.batches.length} batches</div>
              <div className="rounded-lg border px-3 py-2">{state.inspections.length} inspections</div>
              <div className="rounded-lg border px-3 py-2">{state.orders.length} orders</div>
              <div className="rounded-lg border px-3 py-2">{state.allocations.length} allocations</div>
              <Button variant="destructive" onClick={() => { resetDemo(); setCat(structuredClone(TOMATO)); toast.success("Demo data reset"); }}><RotateCcw /> Reset demo data</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
