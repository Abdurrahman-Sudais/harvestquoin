import type { BatchStatus, DispatchStatus, OrderStatus, Packaging, StorageType, TransportMode, InspectionType } from "./types";
import type { PriorityLevel } from "./engine/priority";
import type { RiskLevel, Trend } from "./engine/forecast";

type Tone = "success" | "lime" | "warning" | "danger" | "info" | "muted" | "secondary" | "outline" | "default";

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: Tone }> = {
  awaiting_inspection: { label: "Awaiting inspection", tone: "warning" },
  in_storage: { label: "In storage", tone: "info" },
  partially_allocated: { label: "Partially allocated", tone: "lime" },
  allocated: { label: "Allocated", tone: "success" },
  dispatching: { label: "Dispatching", tone: "default" },
  dispatched: { label: "Dispatched", tone: "muted" },
  on_hold: { label: "On hold", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  awaiting_allocation: { label: "Awaiting allocation", tone: "warning" },
  partially_allocated: { label: "Partially allocated", tone: "lime" },
  allocated: { label: "Allocated", tone: "success" },
  dispatching: { label: "Dispatching", tone: "default" },
  delivered: { label: "Delivered", tone: "muted" },
  on_hold: { label: "On hold", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const DISPATCH_STATUS: Record<DispatchStatus, { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "info" },
  loading: { label: "Loading", tone: "warning" },
  in_transit: { label: "In transit", tone: "default" },
  delivered: { label: "Delivered", tone: "success" },
};

export const PRIORITY: Record<PriorityLevel, { label: string; tone: Tone; dot: string }> = {
  dispatch_now: { label: "Dispatch now", tone: "danger", dot: "bg-red-500" },
  dispatch_soon: { label: "Dispatch soon", tone: "warning", dot: "bg-amber-500" },
  review: { label: "Review", tone: "info", dot: "bg-sky-500" },
  monitor: { label: "Monitor", tone: "muted", dot: "bg-emerald-500" },
};

export const RISK: Record<RiskLevel, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "success" },
  moderate: { label: "Moderate", tone: "lime" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

export const TREND: Record<Trend, string> = {
  stable: "Stable",
  gradual_decline: "Gradual decline",
  rapid_decline: "Rapid decline",
};

export const PACKAGING: Record<Packaging, string> = {
  ventilated_crates: "Ventilated crates",
  plastic_crates: "Plastic crates",
  raffia_baskets: "Raffia baskets",
  bulk_sacks: "Bulk sacks",
};
export const TRANSPORT: Record<TransportMode, string> = {
  reefer_truck: "Refrigerated truck",
  covered_truck: "Covered truck",
  open_truck: "Open truck",
};
export const STORAGE: Record<StorageType, string> = {
  cold_room: "Cold room",
  evaporative_cooler: "Evaporative cooler",
  ambient_shaded: "Ambient (shaded)",
};
export const INSPECTION_TYPE: Record<InspectionType, string> = {
  arrival: "Arrival",
  storage: "Storage",
  pre_dispatch: "Pre-dispatch",
};

export const GRADE_STYLE: Record<string, string> = {
  A: "bg-forest-700 text-white",
  B: "bg-lime-400 text-forest-900",
  C: "bg-amber-400 text-amber-950",
  R: "bg-red-600 text-white",
};
