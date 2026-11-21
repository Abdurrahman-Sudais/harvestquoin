import type { Allocation, AppState, Batch, BatchStatus, Inspection, Order, OrderStatus } from "../types";

export interface BatchInventory {
  arrivalKg: number;
  rejectedKg: number;
  /** Arrival minus rejected/culled quantity. */
  netKg: number;
  /** Sum of approved allocations (all dispatch states). */
  allocatedKg: number;
  /** Allocations that have left the warehouse (in transit or delivered). */
  dispatchedKg: number;
  /** Physically in the warehouse: net − dispatched. */
  onHandKg: number;
  /** Free to allocate: net − allocated (never negative). */
  availableKg: number;
}

/**
 * Deterministic inventory ledger for one batch.
 * All quantities are integer kilograms so the arithmetic is exact.
 */
export function batchInventory(batch: Batch, inspections: Inspection[], allocations: Allocation[]): BatchInventory {
  const rejectedKg = inspections.filter((i) => i.batchId === batch.id).reduce((s, i) => s + Math.round(i.rejectedQtyKg || 0), 0);
  const mine = allocations.filter((a) => a.batchId === batch.id);
  const allocatedKg = mine.reduce((s, a) => s + Math.round(a.qtyKg), 0);
  const dispatchedKg = mine.filter((a) => a.dispatchStatus === "in_transit" || a.dispatchStatus === "delivered").reduce((s, a) => s + Math.round(a.qtyKg), 0);
  const netKg = Math.max(0, Math.round(batch.arrivalQtyKg) - rejectedKg);
  const flaggedRejected = batch.flag === "rejected";
  return {
    arrivalKg: Math.round(batch.arrivalQtyKg),
    rejectedKg,
    netKg,
    allocatedKg,
    dispatchedKg,
    onHandKg: Math.max(0, netKg - dispatchedKg),
    availableKg: flaggedRejected ? 0 : Math.max(0, netKg - allocatedKg),
  };
}

export function inventoryMap(state: Pick<AppState, "batches" | "inspections" | "allocations">) {
  const m = new Map<string, BatchInventory>();
  for (const b of state.batches) m.set(b.id, batchInventory(b, state.inspections, state.allocations));
  return m;
}

export function latestInspection(batchId: string, inspections: Inspection[]): Inspection | undefined {
  let best: Inspection | undefined;
  for (const i of inspections) {
    if (i.batchId !== batchId) continue;
    if (!best || i.date > best.date || (i.date === best.date && i.id > best.id)) best = i;
  }
  return best;
}

export function batchStatus(batch: Batch, inv: BatchInventory, inspections: Inspection[], allocations: Allocation[]): BatchStatus {
  if (batch.flag === "rejected") return "rejected";
  if (inv.netKg === 0) return "rejected";
  if (inv.dispatchedKg >= inv.netKg) return "dispatched";
  if (batch.flag === "on_hold") return "on_hold";
  const hasInspection = inspections.some((i) => i.batchId === batch.id);
  if (!hasInspection) return "awaiting_inspection";
  const mine = allocations.filter((a) => a.batchId === batch.id);
  if (mine.some((a) => a.dispatchStatus === "loading" || a.dispatchStatus === "in_transit")) return "dispatching";
  if (inv.allocatedKg >= inv.netKg) return "allocated";
  if (inv.allocatedKg > 0) return "partially_allocated";
  return "in_storage";
}

export interface OrderProgress {
  allocatedKg: number;
  remainingKg: number;
  dispatchedKg: number;
  deliveredKg: number;
  status: OrderStatus;
}

export function orderProgress(order: Order, allocations: Allocation[]): OrderProgress {
  const mine = allocations.filter((a) => a.orderId === order.id);
  const allocatedKg = mine.reduce((s, a) => s + a.qtyKg, 0);
  const dispatchedKg = mine.filter((a) => a.dispatchStatus === "in_transit" || a.dispatchStatus === "delivered").reduce((s, a) => s + a.qtyKg, 0);
  const deliveredKg = mine.filter((a) => a.dispatchStatus === "delivered").reduce((s, a) => s + a.qtyKg, 0);
  const remainingKg = Math.max(0, order.requiredQtyKg - allocatedKg);
  let status: OrderStatus;
  if (order.manualStatus === "cancelled") status = "cancelled";
  else if (deliveredKg >= order.requiredQtyKg) status = "delivered";
  else if (order.manualStatus === "on_hold") status = "on_hold";
  else if (dispatchedKg > 0 || mine.some((a) => a.dispatchStatus === "loading")) status = "dispatching";
  else if (remainingKg === 0) status = "allocated";
  else if (allocatedKg > 0) status = "partially_allocated";
  else status = "awaiting_allocation";
  return { allocatedKg, remainingKg, dispatchedKg, deliveredKg, status };
}

export type AllocationCheck = { ok: true } | { ok: false; error: string };

/** Guard used before any allocation is created or changed. Prevents over-allocation. */
export function validateAllocation(
  state: Pick<AppState, "batches" | "inspections" | "allocations" | "orders">,
  orderId: string,
  batchId: string,
  qtyKg: number,
  excludeAllocationId?: string
): AllocationCheck {
  if (!Number.isInteger(qtyKg) || qtyKg <= 0) return { ok: false, error: "Quantity must be a whole number of kilograms greater than zero." };
  const batch = state.batches.find((b) => b.id === batchId);
  const order = state.orders.find((o) => o.id === orderId);
  if (!batch || !order) return { ok: false, error: "Batch or order not found." };
  if (batch.categoryId !== order.categoryId) return { ok: false, error: "Batch produce category does not match the order." };
  if (batch.flag) return { ok: false, error: `Batch ${batch.code} is ${batch.flag === "on_hold" ? "on hold" : "rejected"} and cannot be allocated.` };
  if (order.manualStatus !== "open") return { ok: false, error: `Order ${order.code} is not open for allocation.` };
  const others = excludeAllocationId ? state.allocations.filter((a) => a.id !== excludeAllocationId) : state.allocations;
  const inv = batchInventory(batch, state.inspections, others);
  if (qtyKg > inv.availableKg)
    return { ok: false, error: `Only ${inv.availableKg.toLocaleString()} kg of ${batch.code} is available. Requested ${qtyKg.toLocaleString()} kg.` };
  const prog = orderProgress(order, others);
  if (qtyKg > prog.remainingKg)
    return { ok: false, error: `Order ${order.code} needs only ${prog.remainingKg.toLocaleString()} kg more. Requested ${qtyKg.toLocaleString()} kg.` };
  return { ok: true };
}
