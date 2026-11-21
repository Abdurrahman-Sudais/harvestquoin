import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToneBadge } from "@/components/shared";
import { useStore } from "@/lib/store";
import { batchInventory, orderProgress } from "@/lib/engine/inventory";
import { DISPATCH_STATUS } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { fmtKg } from "@/lib/utils";
import type { Allocation } from "@/lib/types";

export function AllocationRow({ a, show = "both" }: { a: Allocation; show?: "batch" | "order" | "both" }) {
  const { state, modifyAllocation, cancelAllocation } = useStore();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(a.qtyKg));
  const b = state.batches.find((x) => x.id === a.batchId)!;
  const o = state.orders.find((x) => x.id === a.orderId)!;
  const others = state.allocations.filter((x) => x.id !== a.id);
  const maxQty = Math.min(batchInventory(b, state.inspections, others).availableKg, orderProgress(o, others).remainingKg);
  const n = Number(qty);
  const err = !Number.isInteger(n) || n <= 0 ? "Whole kg > 0" : n > maxQty ? `Maximum ${maxQty.toLocaleString()} kg` : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
      {show !== "order" && <Link to={`/app/batches/${b.id}`} className="font-semibold text-forest-800 hover:underline">{b.code}</Link>}
      {show !== "batch" && <Link to={`/app/orders/${o.id}`} className="font-medium hover:underline">{o.customer}</Link>}
      <span className="font-display font-bold">{fmtKg(a.qtyKg)}</span>
      <span className="text-xs text-muted-foreground">dispatch {fmtDate(a.plannedDispatchDate)} · approved by {a.approvedBy}{a.wasModified ? " · modified" : ""}</span>
      <span className="ml-auto flex items-center gap-2">
        <ToneBadge tone={DISPATCH_STATUS[a.dispatchStatus].tone}>{DISPATCH_STATUS[a.dispatchStatus].label}</ToneBadge>
        {a.dispatchStatus === "planned" && (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setQty(String(a.qtyKg)); setOpen(true); }} aria-label="Modify"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => { const r = cancelAllocation(a.id); r.ok ? toast.success("Allocation released back to inventory") : toast.error(r.error); }} aria-label="Release"><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modify approved allocation</DialogTitle><DialogDescription>{b.code} → {o.customer}</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label>Quantity (kg)</Label><Input type="number" step={1} value={qty} onChange={(e) => setQty(e.target.value)} /><p className="text-xs text-muted-foreground">Maximum {maxQty.toLocaleString()} kg (available stock and order need)</p>{err && <p className="text-xs text-red-600">{err}</p>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!!err} onClick={() => { const r = modifyAllocation(a.id, n); if (!r.ok) return toast.error(r.error); toast.success("Allocation updated"); setOpen(false); }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
