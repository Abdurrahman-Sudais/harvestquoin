import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, localToday } from "./dates";
import { recommendAllocations, dispatchDateFor, type AllocationPlan } from "./engine/allocation";
import { forecastProvider, type QualityForecast } from "./engine/forecast";
import { batchInventory, batchStatus, inventoryMap, orderProgress, validateAllocation, type BatchInventory } from "./engine/inventory";
import { computeGrade, computeQualityScore } from "./engine/quality";
import { rankDispatchPriority, type DispatchPriority } from "./engine/priority";
import { emitMetric } from "./aws/services";
import { buildSeedState, STATE_VERSION } from "./seed";
import type { ActivityEvent, Allocation, AppState, Batch, BatchStatus, DispatchStatus, Inspection, Order, ProduceCategory } from "./types";

const KEY = "harvestquoin.state.v3";

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === STATE_VERSION) return s;
    }
  } catch {
    /* ignore */
  }
  return buildSeedState(localToday());
}

export interface Derived {
  inventory: Map<string, BatchInventory>;
  forecasts: Map<string, QualityForecast>;
  status: Map<string, BatchStatus>;
  plan: AllocationPlan;
  priority: DispatchPriority[];
}

interface StoreApi {
  state: AppState;
  derived: Derived;
  category: (id: string) => ProduceCategory;
  addBatch(b: Omit<Batch, "id" | "code" | "createdAt">): Result<Batch>;
  updateBatch(id: string, patch: Partial<Batch>): Result;
  addInspection(i: Omit<Inspection, "id" | "qualityScore" | "grade">): Result<Inspection>;
  addOrder(o: Omit<Order, "id" | "code" | "createdAt">): Result<Order>;
  updateOrder(id: string, patch: Partial<Order>): Result;
  approveAllocation(orderId: string, batchId: string, qtyKg: number, meta: { recommendedQtyKg?: number; suitability?: number; explanation: string[] }): Result<Allocation>;
  modifyAllocation(id: string, qtyKg: number): Result;
  cancelAllocation(id: string): Result;
  rejectRecommendation(orderId: string, batchId: string, reason: string): Result;
  restoreRecommendation(orderId: string, batchId: string): void;
  setDispatchStatus(id: string, status: DispatchStatus): Result;
  updateCategory(c: ProduceCategory): void;
  advanceDay(n: number): void;
  resetDemo(): void;
  user: string;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children, user }: { children: ReactNode; user: string }) {
  const [state, setState] = useState<AppState>(load);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full — photos are the usual culprit */
    }
  }, [state]);

  const derived = useMemo<Derived>(() => {
    const inventory = inventoryMap(state);
    const forecasts = new Map<string, QualityForecast>();
    for (const b of state.batches) {
      const cat = state.categories.find((c) => c.id === b.categoryId)!;
      const f = forecastProvider.forecast({ batch: b, category: cat, inspections: state.inspections, supplier: state.suppliers.find((s) => s.id === b.supplierId), asOf: state.today });
      if (f) forecasts.set(b.id, f);
    }
    const status = new Map<string, BatchStatus>();
    for (const b of state.batches) status.set(b.id, batchStatus(b, inventory.get(b.id)!, state.inspections, state.allocations));
    const plan = recommendAllocations(state, forecasts);
    const priority = rankDispatchPriority(state, forecasts);
    return { inventory, forecasts, status, plan, priority };
  }, [state]);

  const commit = useCallback((fn: (s: AppState) => AppState) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const event = (kind: ActivityEvent["kind"], message: string, ref?: string): ActivityEvent => ({
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    kind,
    message,
    ref,
  });

  const api: StoreApi = {
    state,
    derived,
    user,
    category: (id) => state.categories.find((c) => c.id === id) ?? state.categories[0],

    addBatch(input) {
      const s = stateRef.current;
      if (input.arrivalQtyKg <= 0 || !Number.isInteger(input.arrivalQtyKg)) return { ok: false, error: "Arrival quantity must be a positive whole number of kg." };
      const seq = s.batches.filter((b) => Number(b.id.slice(2)) < 100).length + 1;
      const n = Math.max(seq, ...s.batches.map((b) => Number(b.id.slice(2))).filter((x) => x < 100)) + 1;
      const a = input.arrivalDate;
      const batch: Batch = { ...input, id: `b-${n}`, code: `TOM-${a.slice(2, 4)}${a.slice(5, 7)}${a.slice(8, 10)}-${String(n).padStart(3, "0")}`, createdAt: new Date().toISOString() };
      commit((st) => ({ ...st, batches: [...st.batches, batch], activity: [event("batch", `${user} registered batch ${batch.code} (${batch.arrivalQtyKg.toLocaleString()} kg ${batch.variety})`, batch.id), ...st.activity] }));
      emitMetric("BatchRegistered", 1, { variety: batch.variety });
      return { ok: true, value: batch };
    },

    updateBatch(id, patch) {
      commit((st) => ({
        ...st,
        batches: st.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        activity: patch.flag !== undefined ? [event("batch", `${user} ${patch.flag ? `set batch to ${patch.flag.replace("_", " ")}` : "released batch hold"}`, id), ...st.activity] : st.activity,
      }));
      return { ok: true, value: undefined };
    },

    addInspection(input) {
      const s = stateRef.current;
      const batch = s.batches.find((b) => b.id === input.batchId);
      if (!batch) return { ok: false, error: "Batch not found." };
      const cat = s.categories.find((c) => c.id === batch.categoryId)!;
      const inv = batchInventory(batch, s.inspections, s.allocations);
      const rej = Math.round(input.rejectedQtyKg || 0);
      // Culling can only remove stock that is physically present and not already committed.
      if (rej < 0) return { ok: false, error: "Rejected quantity cannot be negative." };
      if (rej > inv.availableKg) return { ok: false, error: `Cannot reject ${rej.toLocaleString()} kg — only ${inv.availableKg.toLocaleString()} kg is unallocated in ${batch.code}.` };
      const qualityScore = computeQualityScore(cat, input.values);
      const insp: Inspection = { ...input, rejectedQtyKg: rej, id: `i-${Date.now().toString(36)}`, qualityScore, grade: computeGrade(cat, qualityScore, input.values) };
      commit((st) => ({ ...st, inspections: [...st.inspections, insp], activity: [event("inspection", `${insp.inspector} recorded ${insp.type.replace("_", "-")} inspection for ${batch.code} — grade ${insp.grade}`, batch.id), ...st.activity] }));
      return { ok: true, value: insp };
    },

    addOrder(input) {
      const s = stateRef.current;
      if (input.requiredQtyKg <= 0 || !Number.isInteger(input.requiredQtyKg)) return { ok: false, error: "Required quantity must be a positive whole number of kg." };
      const n = Math.max(0, ...s.orders.map((o) => Number(o.id.slice(2))).filter((x) => x < 100)) + 1;
      const d = input.deliveryDate;
      const order: Order = { ...input, id: `o-${n}`, code: `SO-${d.slice(2, 4)}${d.slice(5, 7)}-${String(n).padStart(3, "0")}`, createdAt: new Date().toISOString() };
      commit((st) => ({ ...st, orders: [...st.orders, order], activity: [event("order", `${user} created order ${order.code} for ${order.customer} (${order.requiredQtyKg.toLocaleString()} kg, grade ${order.acceptedGrade})`, order.id), ...st.activity] }));
      return { ok: true, value: order };
    },

    updateOrder(id, patch) {
      const s = stateRef.current;
      const o = s.orders.find((x) => x.id === id);
      if (!o) return { ok: false, error: "Order not found." };
      if (patch.requiredQtyKg !== undefined) {
        const prog = orderProgress(o, s.allocations);
        if (patch.requiredQtyKg < prog.allocatedKg) return { ok: false, error: `Already ${prog.allocatedKg.toLocaleString()} kg allocated — cannot reduce below that.` };
      }
      commit((st) => ({ ...st, orders: st.orders.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      return { ok: true, value: undefined };
    },

    approveAllocation(orderId, batchId, qtyKg, meta) {
      const s = stateRef.current;
      const check = validateAllocation(s, orderId, batchId, qtyKg);
      if (!check.ok) return check;
      const order = s.orders.find((o) => o.id === orderId)!;
      const batch = s.batches.find((b) => b.id === batchId)!;
      const alloc: Allocation = {
        id: `a-${Date.now().toString(36)}`,
        orderId,
        batchId,
        qtyKg,
        dispatchStatus: "planned",
        plannedDispatchDate: dispatchDateFor(order) < s.today ? s.today : dispatchDateFor(order),
        approvedBy: user,
        approvedAt: new Date().toISOString(),
        wasModified: meta.recommendedQtyKg !== undefined && meta.recommendedQtyKg !== qtyKg,
        recommendedQtyKg: meta.recommendedQtyKg,
        suitability: meta.suitability,
        explanation: meta.explanation,
      };
      commit((st) => ({ ...st, allocations: [...st.allocations, alloc], activity: [event("allocation", `${user} approved ${qtyKg.toLocaleString()} kg of ${batch.code} for ${order.customer}${alloc.wasModified ? " (modified)" : ""}`, order.id), ...st.activity] }));
      emitMetric("AllocationApproved", qtyKg, { order: order.code });
      return { ok: true, value: alloc };
    },

    modifyAllocation(id, qtyKg) {
      const s = stateRef.current;
      const a = s.allocations.find((x) => x.id === id);
      if (!a) return { ok: false, error: "Allocation not found." };
      if (a.dispatchStatus !== "planned") return { ok: false, error: "Only planned allocations can be changed." };
      const check = validateAllocation(s, a.orderId, a.batchId, qtyKg, id);
      if (!check.ok) return check;
      commit((st) => ({ ...st, allocations: st.allocations.map((x) => (x.id === id ? { ...x, qtyKg, wasModified: true } : x)), activity: [event("allocation", `${user} changed allocation to ${qtyKg.toLocaleString()} kg`, a.orderId), ...st.activity] }));
      return { ok: true, value: undefined };
    },

    cancelAllocation(id) {
      const s = stateRef.current;
      const a = s.allocations.find((x) => x.id === id);
      if (!a) return { ok: false, error: "Allocation not found." };
      if (a.dispatchStatus !== "planned") return { ok: false, error: "Allocations already loading or dispatched cannot be cancelled." };
      commit((st) => ({ ...st, allocations: st.allocations.filter((x) => x.id !== id), activity: [event("allocation", `${user} released ${a.qtyKg.toLocaleString()} kg allocation back to inventory`, a.orderId), ...st.activity] }));
      return { ok: true, value: undefined };
    },

    rejectRecommendation(orderId, batchId, reason) {
      const s = stateRef.current;
      const b = s.batches.find((x) => x.id === batchId);
      const o = s.orders.find((x) => x.id === orderId);
      commit((st) => ({
        ...st,
        rejectedRecommendations: [...st.rejectedRecommendations, { orderId, batchId, reason, rejectedBy: user, at: new Date().toISOString() }],
        activity: [event("allocation", `${user} rejected recommendation ${b?.code} → ${o?.customer}: ${reason}`, orderId), ...st.activity],
      }));
      return { ok: true, value: undefined };
    },

    restoreRecommendation(orderId, batchId) {
      commit((st) => ({ ...st, rejectedRecommendations: st.rejectedRecommendations.filter((r) => !(r.orderId === orderId && r.batchId === batchId)) }));
    },

    setDispatchStatus(id, status) {
      const s = stateRef.current;
      const a = s.allocations.find((x) => x.id === id);
      if (!a) return { ok: false, error: "Allocation not found." };
      const flow: DispatchStatus[] = ["planned", "loading", "in_transit", "delivered"];
      if (flow.indexOf(status) < flow.indexOf(a.dispatchStatus)) return { ok: false, error: "Dispatch status cannot move backwards." };
      const b = s.batches.find((x) => x.id === a.batchId);
      commit((st) => ({
        ...st,
        allocations: st.allocations.map((x) =>
          x.id === id
            ? {
                ...x,
                dispatchStatus: status,
                dispatchedOn: status === "in_transit" || status === "delivered" ? x.dispatchedOn ?? st.today : x.dispatchedOn,
                deliveredOn: status === "delivered" ? st.today : x.deliveredOn,
                outcome: status === "delivered" ? x.outcome ?? "accepted" : x.outcome,
              }
            : x
        ),
        activity: [event("dispatch", `${b?.code} · ${a.qtyKg.toLocaleString()} kg marked ${status.replace("_", " ")}`, a.orderId), ...st.activity],
      }));
      return { ok: true, value: undefined };
    },

    updateCategory(c) {
      commit((st) => ({ ...st, categories: st.categories.map((x) => (x.id === c.id ? c : x)), activity: [event("system", `${user} updated ${c.name} grading configuration`), ...st.activity] }));
    },

    advanceDay(n) {
      commit((st) => ({ ...st, today: addDays(st.today, n), activity: [event("system", `Operating date moved ${n > 0 ? "forward" : "back"} to ${addDays(st.today, n)}`), ...st.activity] }));
    },

    resetDemo() {
      const fresh = buildSeedState(localToday());
      commit(() => fresh);
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
