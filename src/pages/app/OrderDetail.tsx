import { Link, useParams } from "react-router-dom";
import { ArrowLeft, PauseCircle, PlayCircle, XCircle, ShoppingCart, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, GradeBadge, PageHeader, ScoreBar, Stat, ToneBadge } from "@/components/shared";
import { RecommendationCard } from "@/components/shared/RecommendationCard";
import { AllocationRow } from "@/components/shared/AllocationRow";
import { useStore } from "@/lib/store";
import { orderProgress } from "@/lib/engine/inventory";
import { dispatchDateFor } from "@/lib/engine/allocation";
import { ORDER_STATUS } from "@/lib/labels";
import { fmtDate, relDays } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";

export default function OrderDetail() {
  const { id } = useParams();
  const { state, derived, updateOrder, category } = useStore();
  const o = state.orders.find((x) => x.id === id);
  if (!o) return <EmptyState icon={ShoppingCart} title="Order not found" action={<Button asChild><Link to="/app/orders">Back to orders</Link></Button>} />;
  const cat = category(o.categoryId);
  const prog = orderProgress(o, state.allocations);
  const allocs = state.allocations.filter((a) => a.orderId === o.id);
  const recs = derived.plan.recommendations.filter((r) => r.orderId === o.id);
  const short = derived.plan.shortfalls.find((s) => s.orderId === o.id);
  const closed = prog.status === "delivered" || prog.status === "cancelled";

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2"><Link to="/app/orders"><ArrowLeft /> All orders</Link></Button>
      <PageHeader
        eyebrow={`${o.code} · ${o.customerType}`}
        title={o.customer}
        description={<ToneBadge tone={ORDER_STATUS[prog.status].tone}>{ORDER_STATUS[prog.status].label}</ToneBadge>}
        actions={!closed && (
          <>
            {o.manualStatus === "on_hold" ? <Button variant="outline" onClick={() => { updateOrder(o.id, { manualStatus: "open" }); toast.success("Order reopened"); }}><PlayCircle /> Reopen</Button> : <Button variant="outline" onClick={() => { updateOrder(o.id, { manualStatus: "on_hold" }); toast("Order on hold — excluded from recommendations"); }}><PauseCircle /> Hold</Button>}
            <Button variant="outline" className="text-red-600" disabled={allocs.some((a) => a.dispatchStatus !== "planned")} onClick={() => { if (allocs.length) return toast.error("Release approved allocations before cancelling."); updateOrder(o.id, { manualStatus: "cancelled" }); toast("Order cancelled"); }}><XCircle /> Cancel order</Button>
          </>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <Stat label="Produce category" value={cat.name} />
            <Stat label="Variety" value={o.variety ?? "Any variety"} />
            <Stat label="Required quantity" value={fmtKg(o.requiredQtyKg)} />
            <Stat label="Accepted commercial grade" value={<span className="flex items-center gap-2"><GradeBadge grade={o.acceptedGrade} size="sm" />{cat.grades.find((g) => g.code === o.acceptedGrade)?.label} or better</span>} />
            <Stat label="Delivery date" value={`${fmtDate(o.deliveryDate, { weekday: true, year: true })} (${relDays(o.deliveryDate, state.today)})`} />
            <Stat label="Dispatch by" value={`${fmtDate(dispatchDateFor(o), { weekday: true })} · ${o.transitDays} day transit`} />
            <Stat label="Delivery location" value={o.deliveryLocation} className="sm:col-span-3" />
            <div className="sm:col-span-3"><div className="mb-2 text-xs text-muted-foreground">Quality specifications</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-muted px-2 py-1">Damage ≤ {o.spec.maxDamagePct}%</span>
                <span className="rounded-md bg-muted px-2 py-1">Decay ≤ {o.spec.maxDecayPct}%</span>
                {o.spec.minFirmness && <span className="rounded-md bg-muted px-2 py-1">Firmness ≥ {o.spec.minFirmness}/10</span>}
                <span className="rounded-md bg-muted px-2 py-1">Ripeness: {o.spec.acceptedRipeness.map((i) => cat.ripenessStages[i]).join(", ")}</span>
              </div>
            </div>
            {o.specialRequirements && <Stat label="Special requirements" value={o.specialRequirements} className="sm:col-span-3" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fulfilment</CardTitle><CardDescription>Deterministic allocation ledger</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ScoreBar score={(prog.allocatedKg / o.requiredQtyKg) * 100} />
            {[["Required", o.requiredQtyKg], ["Allocated (approved)", prog.allocatedKg], ["Dispatched", prog.dispatchedKg], ["Delivered", prog.deliveredKg], ["Remaining to allocate", prog.remainingKg]].map(([l, v]) => (
              <div key={l as string} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium tabular-nums">{(v as number).toLocaleString()} kg</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Approved allocations</CardTitle></CardHeader>
          <CardContent className="space-y-2">{allocs.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : allocs.map((a) => <AllocationRow key={a.id} a={a} show="batch" />)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recommended batches</CardTitle><CardDescription>Approve, modify or reject</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {recs.map((r) => <RecommendationCard key={r.key} rec={r} showOrder={false} />)}
            {short && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />Shortfall {fmtKg(short.shortKg)} — {short.reason}.</div>}
            {!recs.length && !short && <p className="text-sm text-muted-foreground">{prog.remainingKg === 0 ? "Fully allocated." : o.manualStatus !== "open" ? "Order is not open." : "No recommendations."}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
