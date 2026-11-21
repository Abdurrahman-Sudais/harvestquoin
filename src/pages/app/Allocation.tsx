import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCheck, GitMerge, Scale, ShieldCheck, Undo2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, GradeBadge, KpiCard, PageHeader, SimulatedTag } from "@/components/shared";
import { RecommendationCard } from "@/components/shared/RecommendationCard";
import { AllocationRow } from "@/components/shared/AllocationRow";
import { useStore } from "@/lib/store";
import { orderProgress } from "@/lib/engine/inventory";
import { fmtDate } from "@/lib/dates";
import { fmtKg, cn } from "@/lib/utils";

export default function Allocation() {
  const { state, derived, approveAllocation, restoreRecommendation } = useStore();
  const { recommendations, excluded, shortfalls } = derived.plan;
  const [showWhy, setShowWhy] = useState<string | null>(null);
  const byOrder = useMemo(() => {
    const ids = [...new Set([...recommendations.map((r) => r.orderId), ...shortfalls.map((s) => s.orderId)])];
    return ids.map((id) => state.orders.find((o) => o.id === id)!).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  }, [recommendations, shortfalls, state.orders]);
  const approved = state.allocations.filter((a) => a.dispatchStatus === "planned" || a.dispatchStatus === "loading").sort((a, b) => a.plannedDispatchDate.localeCompare(b.plannedDispatchDate));

  const approveAllStrong = () => {
    let n = 0;
    for (const r of recommendations.filter((x) => x.compatibility === "strong")) {
      const res = approveAllocation(r.orderId, r.batchId, r.qtyKg, { recommendedQtyKg: r.qtyKg, suitability: r.suitability, explanation: r.explanation });
      if (res.ok) n++;
    }
    toast.success(`Approved ${n} strong-match recommendation${n === 1 ? "" : "s"}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workflow · Step 5"
        title="Intelligent batch allocation"
        description="Recommended batch-to-order matches considering category, variety, available quantity, current and predicted grade, buyer acceptance criteria, arrival and dispatch dates."
        actions={recommendations.some((r) => r.compatibility === "strong") && <Button onClick={approveAllStrong}><CheckCheck /> Approve all strong matches</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pending recommendations" value={recommendations.length} sub={`${byOrder.length} orders`} icon={GitMerge} tone="lime" />
        <KpiCard label="Volume recommended" value={fmtKg(recommendations.reduce((s, r) => s + r.qtyKg, 0))} icon={Scale} />
        <KpiCard label="Order shortfalls" value={shortfalls.length} sub={shortfalls.length ? fmtKg(shortfalls.reduce((s, x) => s + x.shortKg, 0)) + " uncovered" : "All demand covered"} icon={AlertTriangle} tone={shortfalls.length ? "danger" : "default"} />
        <KpiCard label="Approved, not yet dispatched" value={approved.length} sub={fmtKg(approved.reduce((s, a) => s + a.qtyKg, 0))} icon={ShieldCheck} />
      </div>
      <Card className="mb-6 flex items-start gap-3 bg-forest-50/60 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" />
        <div><span className="font-semibold">Inventory-safe by design.</span> Recommendations are computed deterministically in delivery-date order, deducting kilograms as they are recommended so no two orders share the same stock. Every approval or modification is re-validated against the live inventory ledger and the order's remaining need. Predicted grades used here are <SimulatedTag className="mx-1 align-middle" /> estimates.</div>
      </Card>

      <Tabs defaultValue="recs">
        <TabsList>
          <TabsTrigger value="recs">Recommendations ({recommendations.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({state.rejectedRecommendations.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="recs" className="space-y-6">
          {byOrder.length === 0 && <EmptyState icon={CheckCheck} title="All open orders are allocated" description="New recommendations appear when orders are created or inspections change batch quality." />}
          {byOrder.map((o) => {
            const prog = orderProgress(o, state.allocations);
            const recs = recommendations.filter((r) => r.orderId === o.id);
            const short = shortfalls.find((s) => s.orderId === o.id);
            const ex = excluded.filter((e) => e.orderId === o.id);
            return (
              <Card key={o.id}>
                <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2"><Link to={`/app/orders/${o.id}`} className="hover:underline">{o.customer}</Link><GradeBadge grade={o.acceptedGrade} size="sm" /><span className="text-sm font-normal text-muted-foreground">{o.code}</span></CardTitle>
                    <CardDescription className="mt-1">Due {fmtDate(o.deliveryDate, { weekday: true })} · {o.deliveryLocation} · ≤{o.spec.maxDamagePct}% damage, ≤{o.spec.maxDecayPct}% decay{o.variety ? ` · ${o.variety} only` : ""}</CardDescription>
                  </div>
                  <div className="text-right text-sm"><div className="font-display text-lg font-bold">{fmtKg(prog.remainingKg)}</div><div className="text-xs text-muted-foreground">open of {fmtKg(o.requiredQtyKg)}</div></div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recs.map((r) => <RecommendationCard key={r.key} rec={r} showOrder={false} />)}
                  {short && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div><span className="font-semibold">Shortfall of {fmtKg(short.shortKg)}.</span> {short.reason}. Consider sourcing new batches, adjusting the delivery date, or discussing specification flexibility with the buyer.</div>
                    </div>
                  )}
                  {ex.length > 0 && (
                    <div>
                      <button onClick={() => setShowWhy(showWhy === o.id ? null : o.id)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        Why weren't other batches recommended? ({ex.length}) <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showWhy === o.id && "rotate-180")} />
                      </button>
                      {showWhy === o.id && (
                        <div className="mt-2 divide-y rounded-lg border text-xs">
                          {ex.map((e) => <div key={e.batchId} className="flex gap-3 px-3 py-1.5"><span className="w-32 shrink-0 font-medium">{state.batches.find((b) => b.id === e.batchId)?.code}</span><span className="text-muted-foreground">{e.reason}</span></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
        <TabsContent value="approved" className="space-y-2">
          {approved.length === 0 ? <EmptyState icon={ShieldCheck} title="No approved allocations awaiting dispatch" /> : approved.map((a) => <AllocationRow key={a.id} a={a} />)}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-2">
          {state.rejectedRecommendations.length === 0 ? <EmptyState icon={Undo2} title="No rejected recommendations" /> : state.rejectedRecommendations.map((r) => (
            <div key={`${r.orderId}:${r.batchId}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="font-semibold">{state.batches.find((b) => b.id === r.batchId)?.code}</span>→<span>{state.orders.find((o) => o.id === r.orderId)?.customer}</span>
              <span className="text-xs text-muted-foreground">“{r.reason}” · {r.rejectedBy}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => { restoreRecommendation(r.orderId, r.batchId); toast("Recommendation restored"); }}><Undo2 /> Restore</Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
