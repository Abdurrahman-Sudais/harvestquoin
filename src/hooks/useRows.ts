import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { latestInspection, orderProgress } from "@/lib/engine/inventory";

export function useLookups() {
  const { state } = useStore();
  return useMemo(() => {
    const sup = new Map(state.suppliers.map((s) => [s.id, s]));
    const wh = new Map(state.warehouses.map((w) => [w.id, w]));
    const batch = new Map(state.batches.map((b) => [b.id, b]));
    const order = new Map(state.orders.map((o) => [o.id, o]));
    return { sup, wh, batch, order };
  }, [state]);
}

export function useBatchRows() {
  const { state, derived } = useStore();
  const { sup, wh } = useLookups();
  return useMemo(
    () =>
      state.batches.map((b) => ({
        batch: b,
        inv: derived.inventory.get(b.id)!,
        status: derived.status.get(b.id)!,
        fc: derived.forecasts.get(b.id) ?? null,
        latest: latestInspection(b.id, state.inspections) ?? null,
        supplier: sup.get(b.supplierId)!,
        warehouse: wh.get(b.warehouseId)!,
        priority: derived.priority.find((p) => p.batchId === b.id) ?? null,
      })),
    [state, derived, sup, wh]
  );
}
export type BatchRow = ReturnType<typeof useBatchRows>[number];

export function useOrderRows() {
  const { state } = useStore();
  return useMemo(() => state.orders.map((o) => ({ order: o, prog: orderProgress(o, state.allocations) })), [state]);
}

export const ACTIVE_STATUSES = new Set(["awaiting_inspection", "in_storage", "partially_allocated", "allocated", "dispatching", "on_hold"]);
