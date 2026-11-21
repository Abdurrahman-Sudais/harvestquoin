import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Pencil, X, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GradeBadge, ScoreBar, ToneBadge } from "@/components/shared";
import { useStore } from "@/lib/store";
import type { Recommendation } from "@/lib/engine/allocation";
import { fmtDate } from "@/lib/dates";
import { fmtKg, cn } from "@/lib/utils";

const COMPAT = { strong: { label: "Strong match", tone: "success" }, good: { label: "Good match", tone: "lime" }, marginal: { label: "Marginal match", tone: "warning" } } as const;

export function RecommendationCard({ rec, showOrder = true }: { rec: Recommendation; showOrder?: boolean }) {
  const { state, approveAllocation, rejectRecommendation } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [modify, setModify] = useState(false);
  const [reject, setReject] = useState(false);
  const [qty, setQty] = useState(String(rec.qtyKg));
  const [reason, setReason] = useState("");
  const batch = state.batches.find((b) => b.id === rec.batchId)!;
  const order = state.orders.find((o) => o.id === rec.orderId)!;
  const maxQty = Math.min(rec.availableKg, rec.orderRemainingKg);

  const approve = (q: number) => {
    const r = approveAllocation(rec.orderId, rec.batchId, q, { recommendedQtyKg: rec.qtyKg, suitability: rec.suitability, explanation: rec.explanation });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Approved ${fmtKg(q)} of ${batch.code} → ${order.customer}`, { description: `Planned dispatch ${fmtDate(r.value.plannedDispatchDate, { weekday: true })}` });
    setModify(false);
  };
  const qtyNum = Number(qty);
  const qtyError = !Number.isInteger(qtyNum) || qtyNum <= 0 ? "Enter a whole number of kg greater than 0" : qtyNum > rec.availableKg ? `Exceeds available inventory (${rec.availableKg.toLocaleString()} kg)` : qtyNum > rec.orderRemainingKg ? `Exceeds order's remaining need (${rec.orderRemainingKg.toLocaleString()} kg)` : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/app/batches/${batch.id}`} className="font-semibold text-forest-800 hover:underline">{batch.code}</Link>
            <span className="text-xs text-muted-foreground">{batch.variety} · {batch.storageLocation}</span>
            <ToneBadge tone={COMPAT[rec.compatibility].tone}>{COMPAT[rec.compatibility].label}</ToneBadge>
          </div>
          {showOrder && <div className="mt-1 text-sm">→ <Link to={`/app/orders/${order.id}`} className="font-medium hover:underline">{order.customer}</Link> <span className="text-xs text-muted-foreground">{order.code} · grade {order.acceptedGrade}+ · due {fmtDate(order.deliveryDate)}</span></div>}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
            <div><div className="text-muted-foreground">Recommended</div><div className="mt-0.5 font-display text-base font-bold">{fmtKg(rec.qtyKg)}</div></div>
            <div><div className="text-muted-foreground">Available</div><div className="mt-0.5 font-medium">{fmtKg(rec.availableKg)}</div></div>
            <div><div className="text-muted-foreground">Quality compatibility</div><div className="mt-0.5 flex items-center gap-1"><GradeBadge grade={rec.currentGrade} size="sm" /><span>→</span><GradeBadge grade={rec.predictedGradeAtDelivery} size="sm" predicted /><span className="text-muted-foreground">vs {order.acceptedGrade}</span></div></div>
            <div><div className="text-muted-foreground">Predicted suitability</div><div className="mt-1 flex items-center gap-2"><ScoreBar score={rec.suitability} className="h-1.5 w-14" /><span className="font-semibold">{rec.suitability}</span></div></div>
            <div><div className="text-muted-foreground">Dispatch by</div><div className="mt-0.5 font-medium">{fmtDate(rec.dispatchDate, { weekday: true })}</div></div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 md:flex-col">
          <Button size="sm" onClick={() => approve(rec.qtyKg)}><Check /> Approve</Button>
          <Button size="sm" variant="outline" onClick={() => { setQty(String(rec.qtyKg)); setModify(true); }}><Pencil /> Modify</Button>
          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setReject(true)}><X /> Reject</Button>
        </div>
      </div>
      <button onClick={() => setExpanded(!expanded)} className="mt-3 flex items-center gap-1 text-xs font-medium text-forest-700">
        <Info className="h-3.5 w-3.5" /> Allocation explanation <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && <ul className="mt-2 space-y-1 rounded-lg bg-muted/50 p-3 text-xs">{rec.explanation.map((e) => <li key={e}>• {e}</li>)}</ul>}

      <Dialog open={modify} onOpenChange={setModify}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modify allocation quantity</DialogTitle><DialogDescription>{batch.code} → {order.customer}. Quantity cannot exceed available inventory or the order's remaining need.</DialogDescription></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mq">Quantity (kg)</Label>
            <Input id="mq" type="number" step={1} min={1} max={maxQty} value={qty} onChange={(e) => setQty(e.target.value)} />
            <p className="text-xs text-muted-foreground">Maximum {maxQty.toLocaleString()} kg · recommended {rec.qtyKg.toLocaleString()} kg</p>
            {qtyError && <p className="text-xs text-red-600">{qtyError}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModify(false)}>Cancel</Button><Button disabled={!!qtyError} onClick={() => approve(qtyNum)}>Approve {qtyError ? "" : fmtKg(qtyNum)}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject recommendation</DialogTitle><DialogDescription>{batch.code} will no longer be recommended for {order.customer}. The engine will look for alternatives.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="rr">Reason</Label><Input id="rr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Buyer prefers Padma F1 for this order" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setReject(false)}>Cancel</Button><Button variant="destructive" onClick={() => { if (reason.trim().length < 3) return toast.error("Enter a reason"); rejectRecommendation(rec.orderId, rec.batchId, reason.trim()); setReject(false); toast("Recommendation rejected — alternatives recalculated"); }}>Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
