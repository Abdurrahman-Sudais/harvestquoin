/** Calendar date in ISO format (yyyy-mm-dd). All operational dates are day-precision. */
export type ISODate = string;

export type GradeCode = "A" | "B" | "C" | "R";

export interface GradeDef {
  code: GradeCode;
  label: string;
  /** Minimum composite quality score (0–100) to qualify for this grade. */
  minScore: number;
  description: string;
}

export type CriterionType = "score10" | "percent" | "number";
export type CriterionGroup = "visual" | "physical" | "damage" | "ripeness" | "measurement";

export interface InspectionCriterion {
  key: string;
  label: string;
  group: CriterionGroup;
  type: CriterionType;
  unit?: string;
  min: number;
  max: number;
  /** Relative weight in the composite quality score. 0 = recorded but not scored. */
  weight: number;
  higherIsBetter: boolean;
  /** For "number" criteria: ideal range scores 100%; deviation is penalised. */
  ideal?: [number, number];
  required: boolean;
  help?: string;
}

export interface ProduceCategory {
  id: string;
  name: string;
  active: boolean;
  varieties: string[];
  ripenessStages: string[];
  /** Quality points lost per day under optimal storage (simulation parameter). */
  baseDecayPerDay: number;
  optimalTempC: [number, number];
  chillingThresholdC: number;
  grades: GradeDef[];
  criteria: InspectionCriterion[];
  /** Hard caps: exceeding these limits caps the grade regardless of composite score. */
  hardLimits: { maxDamagePctForA: number; maxDecayPctForB: number; maxDecayPctCommercial: number };
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  locations: string[];
}

export interface Supplier {
  id: string;
  name: string;
  kind: "Farm" | "Cooperative" | "Aggregator";
  state: string;
  /** Share of historical batches accepted by buyers (0–1). */
  historicalAcceptRate: number;
  /** Historical deterioration multiplier learned from past batch outcomes (1 = typical). */
  historicalDecayFactor: number;
  batchesDelivered: number;
}

export type Packaging = "ventilated_crates" | "plastic_crates" | "raffia_baskets" | "bulk_sacks";
export type TransportMode = "reefer_truck" | "covered_truck" | "open_truck";
export type StorageType = "cold_room" | "evaporative_cooler" | "ambient_shaded";

export interface HandlingConditions {
  packaging: Packaging;
  transport: TransportMode;
  transitHours: number;
  precooled: boolean;
  storageType: StorageType;
}

export interface TemperatureReading {
  date: ISODate;
  tempC: number;
  humidityPct?: number;
  source: "logger" | "manual";
}

export type ManualBatchFlag = "on_hold" | "rejected" | null;

export interface Batch {
  id: string;
  code: string;
  categoryId: string;
  variety: string;
  supplierId: string;
  origin: string;
  harvestDate?: ISODate;
  arrivalDate: ISODate;
  arrivalQtyKg: number;
  warehouseId: string;
  storageLocation: string;
  handling: HandlingConditions;
  temperatureLog: TemperatureReading[];
  flag: ManualBatchFlag;
  flagReason?: string;
  notes?: string;
  createdAt: string;
}

export type BatchStatus =
  | "awaiting_inspection"
  | "in_storage"
  | "partially_allocated"
  | "allocated"
  | "dispatching"
  | "dispatched"
  | "on_hold"
  | "rejected";

export interface InspectionPhoto {
  id: string;
  name: string;
  dataUrl: string;
}

export interface InspectionDocument {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  /** Target object key once Amazon S3 storage is connected. */
  s3Key: string;
}

export type InspectionType = "arrival" | "storage" | "pre_dispatch";

export interface Inspection {
  id: string;
  batchId: string;
  date: ISODate;
  type: InspectionType;
  inspector: string;
  values: Record<string, number>;
  ripenessStage: number;
  pulpTempC: number;
  /** Quantity rejected/culled at this inspection (kg). Deducted from batch inventory. */
  rejectedQtyKg: number;
  rejectionReason?: string;
  notes: string;
  photos: InspectionPhoto[];
  documents: InspectionDocument[];
  /** Computed at save time from criteria — an actual inspection result, never a forecast. */
  qualityScore: number;
  grade: GradeCode;
}

export interface QualitySpec {
  maxDamagePct: number;
  maxDecayPct: number;
  acceptedRipeness: number[];
  minFirmness?: number;
}

export type OrderManualStatus = "open" | "on_hold" | "cancelled";

export interface Order {
  id: string;
  code: string;
  customer: string;
  customerType: "Retailer" | "Processor" | "Wholesaler" | "Food Service" | "Exporter";
  categoryId: string;
  variety: string | null;
  requiredQtyKg: number;
  acceptedGrade: GradeCode;
  spec: QualitySpec;
  deliveryDate: ISODate;
  deliveryLocation: string;
  transitDays: number;
  specialRequirements: string;
  manualStatus: OrderManualStatus;
  createdAt: string;
}

export type OrderStatus =
  | "awaiting_allocation"
  | "partially_allocated"
  | "allocated"
  | "dispatching"
  | "delivered"
  | "on_hold"
  | "cancelled";

export type DispatchStatus = "planned" | "loading" | "in_transit" | "delivered";

export interface Allocation {
  id: string;
  orderId: string;
  batchId: string;
  qtyKg: number;
  dispatchStatus: DispatchStatus;
  plannedDispatchDate: ISODate;
  dispatchedOn?: ISODate;
  deliveredOn?: ISODate;
  /** Buyer acceptance outcome on delivery. */
  outcome?: "accepted" | "partially_rejected" | "rejected";
  rejectedOnDeliveryKg?: number;
  approvedBy: string;
  approvedAt: string;
  wasModified: boolean;
  recommendedQtyKg?: number;
  suitability?: number;
  explanation: string[];
}

export interface RejectedRecommendation {
  orderId: string;
  batchId: string;
  reason: string;
  rejectedBy: string;
  at: string;
}

export interface ActivityEvent {
  id: string;
  at: string;
  kind: "batch" | "inspection" | "order" | "allocation" | "dispatch" | "system";
  message: string;
  ref?: string;
}

export interface AppState {
  version: number;
  /** Operating date: the "today" used by every calculation, so results are deterministic. */
  today: ISODate;
  categories: ProduceCategory[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  batches: Batch[];
  inspections: Inspection[];
  orders: Order[];
  allocations: Allocation[];
  rejectedRecommendations: RejectedRecommendation[];
  activity: ActivityEvent[];
}
