import { addDays } from "./dates";
import { computeGrade, computeQualityScore } from "./engine/quality";
import type {
  Allocation,
  AppState,
  Batch,
  HandlingConditions,
  ISODate,
  Inspection,
  Order,
  ProduceCategory,
  Supplier,
  TemperatureReading,
  Warehouse,
} from "./types";

export const STATE_VERSION = 3;

/* -------------------------------------------------------------------------- */
/*  Category configuration — initial focus: fresh tomatoes                    */
/* -------------------------------------------------------------------------- */

export const TOMATO: ProduceCategory = {
  id: "cat-tomato",
  name: "Fresh Tomatoes",
  active: true,
  varieties: ["Roma VF", "UC82B", "Padma F1", "Tropimech", "Petomech"],
  ripenessStages: ["Green", "Breaker", "Turning", "Pink", "Light red", "Red"],
  baseDecayPerDay: 0.6,
  optimalTempC: [10, 14],
  chillingThresholdC: 9,
  hardLimits: { maxDamagePctForA: 6, maxDecayPctForB: 3, maxDecayPctCommercial: 8 },
  grades: [
    { code: "A", label: "Grade A — Premium", minScore: 80, description: "Uniform colour, firm, ≤6% damage, no decay. Retail & food service." },
    { code: "B", label: "Grade B — Standard", minScore: 65, description: "Minor blemishes, good firmness. Wholesale markets." },
    { code: "C", label: "Grade C — Processing", minScore: 50, description: "Soft or blemished but sound. Paste & sauce processing." },
    { code: "R", label: "Reject", minScore: 0, description: "Not commercially acceptable." },
  ],
  criteria: [
    { key: "colour_uniformity", label: "Colour uniformity", group: "visual", type: "score10", min: 1, max: 10, weight: 1, higherIsBetter: true, required: true, help: "1 = highly mixed, 10 = fully uniform" },
    { key: "appearance", label: "Visual defects (appearance)", group: "visual", type: "score10", min: 1, max: 10, weight: 1, higherIsBetter: true, required: true, help: "Blemishes, sunscald, scarring. 10 = clean" },
    { key: "firmness", label: "Firmness", group: "physical", type: "score10", min: 1, max: 10, weight: 1.5, higherIsBetter: true, required: true, help: "Hand-press test. 10 = very firm" },
    { key: "size_uniformity", label: "Size uniformity", group: "physical", type: "score10", min: 1, max: 10, weight: 0.5, higherIsBetter: true, required: false },
    { key: "damage_pct", label: "Mechanical damage", group: "damage", type: "percent", unit: "%", min: 0, max: 30, weight: 1.5, higherIsBetter: false, required: true, help: "Bruised, cracked or crushed fruit in sample" },
    { key: "decay_pct", label: "Decay / mould", group: "damage", type: "percent", unit: "%", min: 0, max: 15, weight: 2, higherIsBetter: false, required: true },
    { key: "brix", label: "Soluble solids", group: "measurement", type: "number", unit: "°Brix", min: 3, max: 8, ideal: [4.5, 6.5], weight: 0.5, higherIsBetter: true, required: false },
    { key: "weight_loss_pct", label: "Moisture / weight loss", group: "measurement", type: "percent", unit: "%", min: 0, max: 10, weight: 0.8, higherIsBetter: false, required: false, help: "Weight loss vs arrival sample" },
  ],
};

export const WAREHOUSES: Warehouse[] = [
  { id: "wh-lag", name: "Ikorodu Packhouse", city: "Lagos", locations: ["Cold Room 1", "Cold Room 2", "Ambient Bay A", "Ambient Bay B", "Pre-cool Tunnel"] },
  { id: "wh-abj", name: "Kuje Cold Hub", city: "Abuja", locations: ["Cold Room A", "Cold Room B", "Evaporative Store"] },
  { id: "wh-kan", name: "Dawanau Aggregation Centre", city: "Kano", locations: ["Cold Room", "Shaded Shed 1", "Shaded Shed 2", "Evaporative Store"] },
];

export const SUPPLIERS: Supplier[] = [
  { id: "sup-1", name: "Kadawa Growers Cooperative", kind: "Cooperative", state: "Kano", historicalAcceptRate: 0.91, historicalDecayFactor: 1.0, batchesDelivered: 46 },
  { id: "sup-2", name: "Ikara Valley Farms", kind: "Farm", state: "Kaduna", historicalAcceptRate: 0.94, historicalDecayFactor: 0.92, batchesDelivered: 31 },
  { id: "sup-3", name: "Jos Plateau Fresh Aggregators", kind: "Aggregator", state: "Plateau", historicalAcceptRate: 0.86, historicalDecayFactor: 1.08, batchesDelivered: 58 },
  { id: "sup-4", name: "Zaria Irrigated Farms", kind: "Farm", state: "Kaduna", historicalAcceptRate: 0.89, historicalDecayFactor: 1.02, batchesDelivered: 22 },
  { id: "sup-5", name: "Kura Smallholders Union", kind: "Cooperative", state: "Kano", historicalAcceptRate: 0.81, historicalDecayFactor: 1.15, batchesDelivered: 64 },
  { id: "sup-6", name: "Funtua Agro Estates", kind: "Farm", state: "Katsina", historicalAcceptRate: 0.95, historicalDecayFactor: 0.9, batchesDelivered: 18 },
  { id: "sup-7", name: "Bauchi Tomato Growers Association", kind: "Cooperative", state: "Bauchi", historicalAcceptRate: 0.84, historicalDecayFactor: 1.1, batchesDelivered: 9 },
  { id: "sup-8", name: "Gombe Greenfields", kind: "Farm", state: "Gombe", historicalAcceptRate: 0.9, historicalDecayFactor: 0.97, batchesDelivered: 6 },
];

const ORIGINS: Record<string, string> = {
  "sup-1": "Kadawa, Garun Mallam LGA, Kano",
  "sup-2": "Ikara LGA, Kaduna",
  "sup-3": "Barkin Ladi, Plateau",
  "sup-4": "Zaria, Kaduna",
  "sup-5": "Kura LGA, Kano",
  "sup-6": "Funtua, Katsina",
  "sup-7": "Darazo, Bauchi",
  "sup-8": "Kwami, Gombe",
};

const INSPECTORS = ["Aisha Bello", "Chinedu Okafor", "Ibrahim Garba", "Funke Adebayo"];

/* -------------------------------------------------------------------------- */
/*  Deterministic PRNG for temperature logs                                   */
/* -------------------------------------------------------------------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type BatchSpec = {
  n: number;
  variety: string;
  sup: string;
  arrive: number; // days before today (positive = past)
  qty: number;
  wh: string;
  loc: string;
  h: HandlingConditions;
  logTemp?: number; // mean logged temp; undefined = no logger
  flag?: Batch["flag"];
  flagReason?: string;
  notes?: string;
};

type V = [number, number, number, number, number, number, number, number];
type InspSpec = {
  b: number;
  ago: number;
  type: Inspection["type"];
  v: V;
  stage: number;
  pulp: number;
  by: number;
  notes: string;
  rej?: number;
  rejReason?: string;
};

const H = (
  packaging: HandlingConditions["packaging"],
  transport: HandlingConditions["transport"],
  transitHours: number,
  precooled: boolean,
  storageType: HandlingConditions["storageType"]
): HandlingConditions => ({ packaging, transport, transitHours, precooled, storageType });

const ACTIVE: BatchSpec[] = [
  { n: 1, variety: "Roma VF", sup: "sup-1", arrive: 2, qty: 12000, wh: "wh-lag", loc: "Cold Room 1", h: H("plastic_crates", "reefer_truck", 18, true, "cold_room"), logTemp: 12.5 },
  { n: 2, variety: "UC82B", sup: "sup-5", arrive: 5, qty: 9500, wh: "wh-lag", loc: "Ambient Bay A", h: H("raffia_baskets", "open_truck", 22, false, "ambient_shaded"), logTemp: 29.5, notes: "Arrived in raffia baskets; bottom layers compressed." },
  { n: 3, variety: "Roma VF", sup: "sup-3", arrive: 4, qty: 7800, wh: "wh-abj", loc: "Cold Room A", h: H("ventilated_crates", "covered_truck", 8, false, "cold_room"), logTemp: 13.2 },
  { n: 4, variety: "Padma F1", sup: "sup-6", arrive: 1, qty: 15000, wh: "wh-lag", loc: "Cold Room 2", h: H("ventilated_crates", "reefer_truck", 20, true, "cold_room"), logTemp: 12 },
  { n: 5, variety: "UC82B", sup: "sup-7", arrive: 7, qty: 6200, wh: "wh-abj", loc: "Evaporative Store", h: H("raffia_baskets", "open_truck", 14, false, "evaporative_cooler"), logTemp: 22 },
  { n: 6, variety: "Roma VF", sup: "sup-2", arrive: 3, qty: 10400, wh: "wh-kan", loc: "Cold Room", h: H("plastic_crates", "covered_truck", 3, false, "cold_room"), logTemp: 13.5 },
  { n: 7, variety: "Tropimech", sup: "sup-4", arrive: 6, qty: 8800, wh: "wh-kan", loc: "Shaded Shed 1", h: H("raffia_baskets", "open_truck", 4, false, "ambient_shaded") },
  { n: 8, variety: "Roma VF", sup: "sup-1", arrive: 0, qty: 11000, wh: "wh-kan", loc: "Shaded Shed 2", h: H("plastic_crates", "covered_truck", 2, false, "ambient_shaded"), notes: "Received this morning — arrival inspection scheduled." },
  { n: 9, variety: "UC82B", sup: "sup-5", arrive: 9, qty: 5600, wh: "wh-kan", loc: "Evaporative Store", h: H("bulk_sacks", "open_truck", 3, false, "evaporative_cooler"), logTemp: 23 },
  { n: 10, variety: "Padma F1", sup: "sup-6", arrive: 3, qty: 9000, wh: "wh-abj", loc: "Cold Room B", h: H("ventilated_crates", "reefer_truck", 16, true, "cold_room"), logTemp: 12.2 },
  { n: 11, variety: "Roma VF", sup: "sup-8", arrive: 2, qty: 7000, wh: "wh-abj", loc: "Cold Room A", h: H("plastic_crates", "covered_truck", 10, false, "cold_room"), logTemp: 13.4 },
  { n: 12, variety: "Tropimech", sup: "sup-3", arrive: 5, qty: 6500, wh: "wh-lag", loc: "Ambient Bay B", h: H("raffia_baskets", "covered_truck", 26, false, "ambient_shaded"), logTemp: 28.8 },
  { n: 13, variety: "Roma VF", sup: "sup-2", arrive: 8, qty: 8000, wh: "wh-lag", loc: "Cold Room 1", h: H("plastic_crates", "reefer_truck", 18, true, "cold_room"), logTemp: 12.8 },
  { n: 14, variety: "UC82B", sup: "sup-4", arrive: 4, qty: 4800, wh: "wh-kan", loc: "Shaded Shed 1", h: H("bulk_sacks", "open_truck", 5, false, "ambient_shaded"), flag: "on_hold", flagReason: "Pending pesticide residue certificate from supplier" },
  { n: 15, variety: "Roma VF", sup: "sup-1", arrive: 1, qty: 9200, wh: "wh-abj", loc: "Cold Room B", h: H("plastic_crates", "reefer_truck", 30, true, "cold_room"), logTemp: 12.6 },
  { n: 16, variety: "Padma F1", sup: "sup-6", arrive: 6, qty: 10000, wh: "wh-lag", loc: "Cold Room 2", h: H("ventilated_crates", "reefer_truck", 20, true, "cold_room"), logTemp: 12.4 },
];

const ACTIVE_INSP: InspSpec[] = [
  { b: 1, ago: 2, type: "arrival", v: [9, 9, 9, 8, 2, 0, 5.2, 1], stage: 2, pulp: 14, by: 0, notes: "Excellent uniformity. Crates intact, fruit firm. Logger confirms 12–13°C in transit." },
  { b: 2, ago: 5, type: "arrival", v: [8, 7, 7, 7, 6, 0.5, 5, 2], stage: 3, pulp: 27, by: 1, notes: "Some bruising on bottom layer of baskets. Pulp temp high on arrival." },
  { b: 2, ago: 2, type: "storage", v: [7, 6, 6, 7, 9, 2, 5, 4], stage: 4, pulp: 29, by: 1, notes: "Softening across lot, ~9% damaged, early decay spots. Recommend move to cold room or dispatch.", rej: 350, rejReason: "Crushed fruit from bottom basket layers" },
  { b: 3, ago: 4, type: "arrival", v: [8, 8, 8, 8, 3, 0, 5.5, 1.5], stage: 2, pulp: 18, by: 2, notes: "Good condition, minor scuffing." },
  { b: 3, ago: 1, type: "storage", v: [8, 8, 8, 8, 3, 0.5, 5.6, 2], stage: 3, pulp: 13, by: 2, notes: "Stable in cold room. Colour progressing to pink." },
  { b: 4, ago: 1, type: "arrival", v: [9, 9, 9, 9, 1, 0, 5.8, 0.5], stage: 1, pulp: 12, by: 0, notes: "Premium lot, breaker stage, pre-cooled at farm. Ideal for retail." },
  { b: 5, ago: 7, type: "arrival", v: [7, 7, 7, 6, 7, 1, 4.8, 2], stage: 3, pulp: 26, by: 3, notes: "Mixed sizes, 7% bruising." },
  { b: 5, ago: 4, type: "storage", v: [7, 6, 6, 6, 8, 2, 4.8, 3.5], stage: 4, pulp: 22, by: 3, notes: "Progressing quickly, softening." },
  { b: 5, ago: 1, type: "storage", v: [6, 5, 5, 6, 10, 3.5, 4.9, 5], stage: 5, pulp: 22, by: 3, notes: "Soft fruit, leaking in places. Suitable for processing only.", rej: 420, rejReason: "Soft and leaking fruit removed" },
  { b: 6, ago: 3, type: "arrival", v: [9, 8, 8, 8, 3, 0, 5.4, 1], stage: 2, pulp: 20, by: 2, notes: "Clean lot, short transit from Ikara." },
  { b: 7, ago: 6, type: "arrival", v: [8, 7, 7, 7, 5, 0.5, 5, 2], stage: 3, pulp: 28, by: 2, notes: "Acceptable. Stored in shaded shed, no logger fitted." },
  { b: 9, ago: 9, type: "arrival", v: [7, 6, 6, 6, 10, 1, 4.6, 3], stage: 3, pulp: 27, by: 2, notes: "Bulk sacks — 10% compression damage." },
  { b: 9, ago: 5, type: "storage", v: [6, 5, 5, 6, 13, 3, 4.6, 5], stage: 4, pulp: 23, by: 2, notes: "Damage increasing, decay visible.", rej: 600, rejReason: "Decayed fruit culled" },
  { b: 9, ago: 2, type: "storage", v: [5, 5, 4, 5, 15, 4.5, 4.7, 6.5], stage: 5, pulp: 23, by: 3, notes: "Very soft. Processing grade at best. Dispatch urgently.", rej: 380, rejReason: "Mould and leaking fruit" },
  { b: 10, ago: 3, type: "arrival", v: [9, 9, 9, 9, 1.5, 0, 5.9, 0.8], stage: 2, pulp: 12, by: 2, notes: "Excellent. Reefer logger clean." },
  { b: 10, ago: 1, type: "storage", v: [9, 9, 9, 9, 1.5, 0, 6, 1], stage: 2, pulp: 12, by: 2, notes: "No change." },
  { b: 11, ago: 2, type: "arrival", v: [8, 8, 8, 7, 4, 0, 5.1, 1.5], stage: 3, pulp: 19, by: 3, notes: "Good. First batch from Gombe Greenfields this season." },
  { b: 12, ago: 5, type: "arrival", v: [8, 7, 8, 7, 5, 0.5, 5.2, 2], stage: 2, pulp: 26, by: 1, notes: "26h transit, warm on arrival." },
  { b: 12, ago: 2, type: "storage", v: [7, 7, 7, 7, 6, 1, 5.2, 3], stage: 3, pulp: 28, by: 1, notes: "Holding but ambient bay is warm." },
  { b: 13, ago: 8, type: "arrival", v: [9, 8, 8, 8, 2, 0, 5.3, 1], stage: 2, pulp: 14, by: 0, notes: "Strong lot." },
  { b: 13, ago: 4, type: "storage", v: [8, 8, 8, 8, 2, 0.5, 5.4, 1.5], stage: 3, pulp: 13, by: 0, notes: "Stable." },
  { b: 13, ago: 1, type: "pre_dispatch", v: [8, 7, 7, 8, 3, 1, 5.4, 2.5], stage: 4, pulp: 13, by: 0, notes: "Light red, firmness easing. Prioritise for dispatch this week." },
  { b: 14, ago: 4, type: "arrival", v: [7, 6, 6, 6, 9, 1, 4.9, 3], stage: 3, pulp: 29, by: 2, notes: "Sacks, compression damage. Residue certificate not supplied — placed on hold." },
  { b: 15, ago: 1, type: "arrival", v: [8, 8, 8, 8, 3, 0, 5.3, 1.5], stage: 2, pulp: 13, by: 3, notes: "Good condition after 30h reefer transit." },
  { b: 16, ago: 6, type: "arrival", v: [9, 9, 9, 9, 1, 0, 5.8, 0.5], stage: 1, pulp: 12, by: 0, notes: "Premium Padma, breaker." },
  { b: 16, ago: 3, type: "storage", v: [9, 9, 8, 9, 1.5, 0, 5.9, 1], stage: 2, pulp: 12, by: 0, notes: "Ripening evenly." },
  { b: 16, ago: 1, type: "pre_dispatch", v: [8, 8, 8, 8, 2, 0.5, 6, 1.5], stage: 3, pulp: 12, by: 0, notes: "Pink stage. Partial dispatch to Greenleaf loaded." },
];

/* Historical, closed-out batches for analytics (arrivals 12–34 days ago). */
const HISTORICAL: BatchSpec[] = [
  { n: 101, variety: "Roma VF", sup: "sup-1", arrive: 34, qty: 10000, wh: "wh-lag", loc: "Cold Room 1", h: H("plastic_crates", "reefer_truck", 18, true, "cold_room"), logTemp: 12.5 },
  { n: 102, variety: "UC82B", sup: "sup-5", arrive: 31, qty: 8000, wh: "wh-kan", loc: "Shaded Shed 1", h: H("raffia_baskets", "open_truck", 4, false, "ambient_shaded") },
  { n: 103, variety: "Padma F1", sup: "sup-6", arrive: 29, qty: 9000, wh: "wh-abj", loc: "Cold Room A", h: H("ventilated_crates", "reefer_truck", 16, true, "cold_room"), logTemp: 12 },
  { n: 104, variety: "Roma VF", sup: "sup-3", arrive: 26, qty: 7000, wh: "wh-abj", loc: "Cold Room B", h: H("ventilated_crates", "covered_truck", 8, false, "cold_room"), logTemp: 13 },
  { n: 105, variety: "Tropimech", sup: "sup-4", arrive: 24, qty: 6000, wh: "wh-kan", loc: "Evaporative Store", h: H("raffia_baskets", "open_truck", 5, false, "evaporative_cooler"), logTemp: 22 },
  { n: 106, variety: "UC82B", sup: "sup-7", arrive: 22, qty: 5000, wh: "wh-lag", loc: "Ambient Bay A", h: H("bulk_sacks", "open_truck", 24, false, "ambient_shaded"), logTemp: 30, flag: "rejected", flagReason: "Rejected on arrival — widespread decay and crushing" },
  { n: 107, variety: "Roma VF", sup: "sup-2", arrive: 19, qty: 9500, wh: "wh-lag", loc: "Cold Room 2", h: H("plastic_crates", "reefer_truck", 18, true, "cold_room"), logTemp: 12.4 },
  { n: 108, variety: "Roma VF", sup: "sup-1", arrive: 16, qty: 8500, wh: "wh-kan", loc: "Cold Room", h: H("plastic_crates", "covered_truck", 3, false, "cold_room"), logTemp: 13.5 },
  { n: 109, variety: "Padma F1", sup: "sup-6", arrive: 14, qty: 7500, wh: "wh-abj", loc: "Cold Room A", h: H("ventilated_crates", "reefer_truck", 16, true, "cold_room"), logTemp: 12.2 },
  { n: 110, variety: "UC82B", sup: "sup-5", arrive: 12, qty: 6500, wh: "wh-kan", loc: "Evaporative Store", h: H("raffia_baskets", "open_truck", 3, false, "evaporative_cooler"), logTemp: 22.5 },
];

const HIST_INSP: InspSpec[] = [
  { b: 101, ago: 34, type: "arrival", v: [9, 8, 9, 8, 2, 0, 5.3, 1], stage: 2, pulp: 14, by: 0, notes: "Strong lot." },
  { b: 101, ago: 30, type: "pre_dispatch", v: [8, 8, 8, 8, 3, 0.5, 5.4, 2], stage: 3, pulp: 13, by: 0, notes: "Ready." },
  { b: 102, ago: 31, type: "arrival", v: [7, 6, 6, 6, 8, 1, 4.8, 3], stage: 3, pulp: 28, by: 2, notes: "Bruising.", rej: 400, rejReason: "Crushed fruit" },
  { b: 102, ago: 29, type: "pre_dispatch", v: [6, 6, 5, 6, 11, 2.5, 4.8, 4.5], stage: 4, pulp: 29, by: 2, notes: "Soft.", rej: 300, rejReason: "Soft fruit culled" },
  { b: 103, ago: 29, type: "arrival", v: [9, 9, 9, 9, 1, 0, 5.9, 0.5], stage: 1, pulp: 12, by: 2, notes: "Premium." },
  { b: 104, ago: 26, type: "arrival", v: [8, 8, 8, 7, 4, 0, 5.2, 1.5], stage: 2, pulp: 17, by: 3, notes: "Good." },
  { b: 104, ago: 23, type: "storage", v: [8, 7, 7, 7, 4, 1, 5.3, 2.5], stage: 3, pulp: 13, by: 3, notes: "Stable.", rej: 150, rejReason: "Minor decay" },
  { b: 105, ago: 24, type: "arrival", v: [7, 7, 7, 7, 6, 1, 5, 2], stage: 3, pulp: 24, by: 1, notes: "Fair." },
  { b: 105, ago: 21, type: "storage", v: [6, 6, 6, 6, 8, 2.5, 5, 4], stage: 4, pulp: 22, by: 1, notes: "Softening.", rej: 250, rejReason: "Decayed fruit" },
  { b: 106, ago: 22, type: "arrival", v: [4, 4, 3, 5, 22, 9, 4.5, 7], stage: 5, pulp: 31, by: 1, notes: "Widespread crushing and mould. Lot rejected; supplier notified.", rej: 5000, rejReason: "Entire lot rejected — decay above commercial limit" },
  { b: 107, ago: 19, type: "arrival", v: [9, 9, 9, 8, 2, 0, 5.5, 1], stage: 2, pulp: 13, by: 0, notes: "Excellent." },
  { b: 107, ago: 15, type: "pre_dispatch", v: [8, 8, 8, 8, 2, 0.5, 5.6, 1.8], stage: 3, pulp: 12, by: 0, notes: "Ready." },
  { b: 108, ago: 16, type: "arrival", v: [8, 8, 8, 8, 3, 0, 5.3, 1.5], stage: 2, pulp: 20, by: 2, notes: "Good." },
  { b: 109, ago: 14, type: "arrival", v: [9, 9, 9, 9, 1, 0, 6, 0.5], stage: 1, pulp: 12, by: 2, notes: "Premium." },
  { b: 109, ago: 10, type: "pre_dispatch", v: [9, 8, 8, 9, 1.5, 0, 6, 1.2], stage: 3, pulp: 12, by: 2, notes: "Ready." },
  { b: 110, ago: 12, type: "arrival", v: [7, 7, 6, 6, 7, 1, 4.9, 2.5], stage: 3, pulp: 25, by: 3, notes: "Fair.", rej: 200, rejReason: "Crushed fruit" },
  { b: 110, ago: 9, type: "storage", v: [6, 6, 5, 6, 10, 2.5, 4.9, 4.5], stage: 4, pulp: 22, by: 3, notes: "Soft.", rej: 300, rejReason: "Decay" },
];

type OrderSpec = Omit<Order, "id" | "deliveryDate" | "createdAt" | "categoryId" | "spec"> & { n: number; due: number; spec: Order["spec"] };

const SPEC = {
  retail: { maxDamagePct: 5, maxDecayPct: 1, acceptedRipeness: [2, 3, 4], minFirmness: 7 },
  wholesale: { maxDamagePct: 10, maxDecayPct: 3, acceptedRipeness: [1, 2, 3, 4, 5] },
  food: { maxDamagePct: 8, maxDecayPct: 2, acceptedRipeness: [3, 4, 5] },
  process: { maxDamagePct: 20, maxDecayPct: 6, acceptedRipeness: [3, 4, 5] },
};

const ACTIVE_ORDERS: OrderSpec[] = [
  { n: 10, code: "", customer: "Greenleaf Supermarkets", customerType: "Retailer", variety: null, requiredQtyKg: 4000, acceptedGrade: "A", spec: SPEC.retail, due: 0, deliveryLocation: "Greenleaf DC, Lekki, Lagos", transitDays: 0, specialRequirements: "10 kg ventilated cartons, batch label on each carton.", manualStatus: "open" },
  { n: 1, code: "", customer: "Greenleaf Supermarkets", customerType: "Retailer", variety: null, requiredQtyKg: 6000, acceptedGrade: "A", spec: SPEC.retail, due: 2, deliveryLocation: "Greenleaf DC, Lekki, Lagos", transitDays: 1, specialRequirements: "10 kg ventilated cartons, batch label on each carton. Delivery window 06:00–09:00.", manualStatus: "open" },
  { n: 2, code: "", customer: "Sunbeam Tomato Processing Ltd", customerType: "Processor", variety: null, requiredQtyKg: 8000, acceptedGrade: "C", spec: SPEC.process, due: 1, deliveryLocation: "Sunbeam factory, Sharada Industrial Estate, Kano", transitDays: 0, specialRequirements: "Bulk delivery accepted. Red/light-red preferred for paste colour.", manualStatus: "open" },
  { n: 3, code: "", customer: "Mile 12 Produce Traders", customerType: "Wholesaler", variety: null, requiredQtyKg: 10000, acceptedGrade: "B", spec: SPEC.wholesale, due: 1, deliveryLocation: "Mile 12 International Market, Lagos", transitDays: 0, specialRequirements: "Arrive before 05:00. Plastic crates returned on delivery.", manualStatus: "open" },
  { n: 4, code: "", customer: "Palmview Hotels & Catering", customerType: "Food Service", variety: null, requiredQtyKg: 2500, acceptedGrade: "B", spec: SPEC.food, due: 3, deliveryLocation: "Palmview Central Kitchen, Garki, Abuja", transitDays: 1, specialRequirements: "Ready-to-use ripeness (pink to red).", manualStatus: "open" },
  { n: 5, code: "", customer: "FreshBox Lagos", customerType: "Retailer", variety: "Padma F1", requiredQtyKg: 3000, acceptedGrade: "A", spec: SPEC.retail, due: 4, deliveryLocation: "FreshBox fulfilment centre, Yaba, Lagos", transitDays: 1, specialRequirements: "Padma F1 only — sold as named variety.", manualStatus: "open" },
  { n: 6, code: "", customer: "Arewa Foods Wholesale", customerType: "Wholesaler", variety: null, requiredQtyKg: 12000, acceptedGrade: "B", spec: SPEC.wholesale, due: 5, deliveryLocation: "Kaduna Central Market, Kaduna", transitDays: 1, specialRequirements: "Split delivery acceptable across two trucks.", manualStatus: "open" },
  { n: 7, code: "", customer: "Capital Grocers", customerType: "Retailer", variety: null, requiredQtyKg: 4000, acceptedGrade: "A", spec: SPEC.retail, due: 6, deliveryLocation: "Capital Grocers, Wuse II, Abuja", transitDays: 1, specialRequirements: "Cold-chain delivery required (reefer).", manualStatus: "open" },
  { n: 8, code: "", customer: "Savannah Paste Co.", customerType: "Processor", variety: null, requiredQtyKg: 9000, acceptedGrade: "C", spec: SPEC.process, due: 8, deliveryLocation: "Savannah Paste Co., Kakuri, Kaduna", transitDays: 1, specialRequirements: "Weighbridge ticket required.", manualStatus: "open" },
  { n: 9, code: "", customer: "Harmattan Kitchens", customerType: "Food Service", variety: null, requiredQtyKg: 1500, acceptedGrade: "B", spec: SPEC.food, due: 2, deliveryLocation: "Harmattan Kitchens, Victoria Island, Lagos", transitDays: 0, specialRequirements: "Deliver to rear service entrance.", manualStatus: "open" },
];

const PAST_ORDERS: OrderSpec[] = [
  { n: 101, code: "", customer: "Greenleaf Supermarkets", customerType: "Retailer", variety: null, requiredQtyKg: 6000, acceptedGrade: "A", spec: SPEC.retail, due: -29, deliveryLocation: "Greenleaf DC, Lekki, Lagos", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 102, code: "", customer: "Mile 12 Produce Traders", customerType: "Wholesaler", variety: null, requiredQtyKg: 4000, acceptedGrade: "B", spec: SPEC.wholesale, due: -30, deliveryLocation: "Mile 12 International Market, Lagos", transitDays: 0, specialRequirements: "", manualStatus: "open" },
  { n: 103, code: "", customer: "Sunbeam Tomato Processing Ltd", customerType: "Processor", variety: null, requiredQtyKg: 7300, acceptedGrade: "C", spec: SPEC.process, due: -28, deliveryLocation: "Sunbeam factory, Kano", transitDays: 0, specialRequirements: "", manualStatus: "open" },
  { n: 104, code: "", customer: "Capital Grocers", customerType: "Retailer", variety: null, requiredQtyKg: 9000, acceptedGrade: "A", spec: SPEC.retail, due: -25, deliveryLocation: "Capital Grocers, Wuse II, Abuja", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 105, code: "", customer: "Arewa Foods Wholesale", customerType: "Wholesaler", variety: null, requiredQtyKg: 6850, acceptedGrade: "B", spec: SPEC.wholesale, due: -21, deliveryLocation: "Kaduna Central Market", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 106, code: "", customer: "Savannah Paste Co.", customerType: "Processor", variety: null, requiredQtyKg: 5750, acceptedGrade: "C", spec: SPEC.process, due: -19, deliveryLocation: "Savannah Paste Co., Kaduna", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 107, code: "", customer: "FreshBox Lagos", customerType: "Retailer", variety: null, requiredQtyKg: 9500, acceptedGrade: "A", spec: SPEC.retail, due: -14, deliveryLocation: "FreshBox, Yaba, Lagos", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 108, code: "", customer: "Palmview Hotels & Catering", customerType: "Food Service", variety: null, requiredQtyKg: 8500, acceptedGrade: "B", spec: SPEC.food, due: -12, deliveryLocation: "Palmview Central Kitchen, Abuja", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 109, code: "", customer: "Greenleaf Supermarkets", customerType: "Retailer", variety: null, requiredQtyKg: 7500, acceptedGrade: "A", spec: SPEC.retail, due: -9, deliveryLocation: "Greenleaf DC, Lekki, Lagos", transitDays: 1, specialRequirements: "", manualStatus: "open" },
  { n: 110, code: "", customer: "Sunbeam Tomato Processing Ltd", customerType: "Processor", variety: null, requiredQtyKg: 6000, acceptedGrade: "C", spec: SPEC.process, due: -7, deliveryLocation: "Sunbeam factory, Kano", transitDays: 0, specialRequirements: "", manualStatus: "open" },
];

type AllocSpec = {
  o: number;
  b: number;
  qty: number;
  status: Allocation["dispatchStatus"];
  dispatchedAgo?: number;
  deliveredAgo?: number;
  outcome?: Allocation["outcome"];
  rejKg?: number;
};

const ALLOCS: AllocSpec[] = [
  // Active
  { o: 10, b: 16, qty: 4000, status: "in_transit", dispatchedAgo: 0 },
  { o: 9, b: 16, qty: 1500, status: "planned" },
  { o: 3, b: 13, qty: 3000, status: "loading" },
  { o: 2, b: 9, qty: 3200, status: "planned" },
  // Historical — delivered
  { o: 101, b: 101, qty: 6000, status: "delivered", dispatchedAgo: 30, deliveredAgo: 29, outcome: "accepted" },
  { o: 102, b: 101, qty: 4000, status: "delivered", dispatchedAgo: 30, deliveredAgo: 30, outcome: "accepted" },
  { o: 103, b: 102, qty: 7300, status: "delivered", dispatchedAgo: 28, deliveredAgo: 27, outcome: "partially_rejected", rejKg: 300 },
  { o: 104, b: 103, qty: 9000, status: "delivered", dispatchedAgo: 26, deliveredAgo: 25, outcome: "accepted" },
  { o: 105, b: 104, qty: 6850, status: "delivered", dispatchedAgo: 22, deliveredAgo: 21, outcome: "accepted" },
  { o: 106, b: 105, qty: 5750, status: "delivered", dispatchedAgo: 20, deliveredAgo: 18, outcome: "partially_rejected", rejKg: 420 },
  { o: 107, b: 107, qty: 9500, status: "delivered", dispatchedAgo: 15, deliveredAgo: 14, outcome: "accepted" },
  { o: 108, b: 108, qty: 8500, status: "delivered", dispatchedAgo: 13, deliveredAgo: 12, outcome: "accepted" },
  { o: 109, b: 109, qty: 7500, status: "delivered", dispatchedAgo: 10, deliveredAgo: 9, outcome: "accepted" },
  { o: 110, b: 110, qty: 6000, status: "delivered", dispatchedAgo: 7, deliveredAgo: 6, outcome: "rejected", rejKg: 650 },
];

/* -------------------------------------------------------------------------- */

function batchCode(arrival: ISODate, n: number) {
  return `TOM-${arrival.slice(2, 4)}${arrival.slice(5, 7)}${arrival.slice(8, 10)}-${String(n).padStart(3, "0")}`;
}

function buildBatch(s: BatchSpec, today: ISODate, rand: () => number): Batch {
  const arrivalDate = addDays(today, -s.arrive);
  const temperatureLog: TemperatureReading[] = [];
  if (s.logTemp !== undefined) {
    for (let d = 0; d <= s.arrive; d++) {
      const date = addDays(arrivalDate, d);
      if (date > today) break;
      temperatureLog.push({ date, tempC: Math.round((s.logTemp + (rand() - 0.5) * 1.6) * 10) / 10, humidityPct: Math.round(s.h.storageType === "cold_room" ? 88 + rand() * 6 : 55 + rand() * 20), source: "logger" });
    }
  }
  return {
    id: `b-${s.n}`,
    code: batchCode(arrivalDate, s.n),
    categoryId: TOMATO.id,
    variety: s.variety,
    supplierId: s.sup,
    origin: ORIGINS[s.sup],
    harvestDate: addDays(arrivalDate, -1),
    arrivalDate,
    arrivalQtyKg: s.qty,
    warehouseId: s.wh,
    storageLocation: s.loc,
    handling: s.h,
    temperatureLog,
    flag: s.flag ?? null,
    flagReason: s.flagReason,
    notes: s.notes,
    createdAt: `${arrivalDate}T07:30:00.000Z`,
  };
}

function buildInspection(s: InspSpec, today: ISODate, idx: number): Inspection {
  const [colour_uniformity, appearance, firmness, size_uniformity, damage_pct, decay_pct, brix, weight_loss_pct] = s.v;
  const values = { colour_uniformity, appearance, firmness, size_uniformity, damage_pct, decay_pct, brix, weight_loss_pct };
  const qualityScore = computeQualityScore(TOMATO, values);
  return {
    id: `i-${String(idx).padStart(3, "0")}`,
    batchId: `b-${s.b}`,
    date: addDays(today, -s.ago),
    type: s.type,
    inspector: INSPECTORS[s.by],
    values,
    ripenessStage: s.stage,
    pulpTempC: s.pulp,
    rejectedQtyKg: s.rej ?? 0,
    rejectionReason: s.rejReason,
    notes: s.notes,
    photos: [],
    documents:
      s.type === "arrival"
        ? [{ id: `d-${idx}`, name: `arrival-checklist-${s.b}.pdf`, sizeBytes: 182_000 + idx * 731, mimeType: "application/pdf", uploadedAt: `${addDays(today, -s.ago)}T09:10:00.000Z`, s3Key: `inspections/b-${s.b}/arrival-checklist.pdf` }]
        : [],
    qualityScore,
    grade: computeGrade(TOMATO, qualityScore, values),
  };
}

function buildOrder(s: OrderSpec, today: ISODate): Order {
  const deliveryDate = addDays(today, s.due);
  return {
    id: `o-${s.n}`,
    code: `SO-${deliveryDate.slice(2, 4)}${deliveryDate.slice(5, 7)}-${String(s.n).padStart(3, "0")}`,
    customer: s.customer,
    customerType: s.customerType,
    categoryId: TOMATO.id,
    variety: s.variety,
    requiredQtyKg: s.requiredQtyKg,
    acceptedGrade: s.acceptedGrade,
    spec: s.spec,
    deliveryDate,
    deliveryLocation: s.deliveryLocation,
    transitDays: s.transitDays,
    specialRequirements: s.specialRequirements,
    manualStatus: s.manualStatus,
    createdAt: `${addDays(deliveryDate, -6)}T10:00:00.000Z`,
  };
}

export function buildSeedState(today: ISODate): AppState {
  const rand = mulberry32(20261121);
  const batches = [...HISTORICAL, ...ACTIVE].map((s) => buildBatch(s, today, rand));
  const inspections = [...HIST_INSP, ...ACTIVE_INSP].map((s, i) => buildInspection(s, today, i + 1));
  const orders = [...PAST_ORDERS, ...ACTIVE_ORDERS].map((s) => buildOrder(s, today));
  const allocations: Allocation[] = ALLOCS.map((a, i) => {
    const order = orders.find((o) => o.id === `o-${a.o}`)!;
    const planned = addDays(order.deliveryDate, -order.transitDays);
    return {
      id: `a-${String(i + 1).padStart(3, "0")}`,
      orderId: order.id,
      batchId: `b-${a.b}`,
      qtyKg: a.qty,
      dispatchStatus: a.status,
      plannedDispatchDate: planned,
      dispatchedOn: a.dispatchedAgo !== undefined ? addDays(today, -a.dispatchedAgo) : undefined,
      deliveredOn: a.deliveredAgo !== undefined ? addDays(today, -a.deliveredAgo) : undefined,
      outcome: a.outcome,
      rejectedOnDeliveryKg: a.rejKg,
      approvedBy: "Hauwa Musa",
      approvedAt: `${addDays(planned, -2)}T15:00:00.000Z`,
      wasModified: false,
      explanation: ["Approved from HarvestQuoin recommendation."],
    };
  });

  const activity = inspections
    .filter((i) => i.date >= addDays(today, -9))
    .map((i) => {
      const b = batches.find((x) => x.id === i.batchId)!;
      return { id: `ev-${i.id}`, at: `${i.date}T09:00:00.000Z`, kind: "inspection" as const, message: `${i.inspector} recorded ${i.type.replace("_", "-")} inspection for ${b.code} — grade ${i.grade}`, ref: b.id };
    });

  return {
    version: STATE_VERSION,
    today,
    categories: [TOMATO],
    warehouses: WAREHOUSES,
    suppliers: SUPPLIERS,
    batches,
    inspections,
    orders,
    allocations,
    rejectedRecommendations: [],
    activity: activity.sort((a, b) => b.at.localeCompare(a.at)),
  };
}

export { INSPECTORS };
