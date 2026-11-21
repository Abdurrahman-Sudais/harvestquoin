import type { ForecastInput, QualityForecast } from "../engine/forecast";
import { averageStorageTemp } from "../engine/forecast";
import { latestInspection } from "../engine/inventory";
import { diffDays } from "../dates";
import { awsConfig } from "./config";

/**
 * Amazon SageMaker AI adapter (prepared, not active in the demo).
 *
 * In production a Lambda behind API Gateway calls `InvokeEndpoint` on the
 * quality-forecast model and caches results per batch in DynamoDB. The UI reads
 * the cached forecast through the same `QualityForecast` shape the simulator returns.
 */
export interface SageMakerFeatureVector {
  batch_id: string;
  category: string;
  variety: string;
  days_since_arrival: number;
  days_since_inspection: number;
  latest_quality_score: number;
  latest_damage_pct: number;
  latest_decay_pct: number;
  ripeness_stage: number;
  storage_temp_c: number;
  temp_from_logger: boolean;
  packaging: string;
  transport: string;
  transit_hours: number;
  precooled: boolean;
  supplier_decay_factor: number;
  inspection_count: number;
}

export function buildFeatureVector(input: ForecastInput): SageMakerFeatureVector | null {
  const li = latestInspection(input.batch.id, input.inspections);
  if (!li) return null;
  const t = averageStorageTemp(input.batch, input.asOf);
  return {
    batch_id: input.batch.id,
    category: input.category.id,
    variety: input.batch.variety,
    days_since_arrival: diffDays(input.asOf, input.batch.arrivalDate),
    days_since_inspection: diffDays(input.asOf, li.date),
    latest_quality_score: li.qualityScore,
    latest_damage_pct: li.values.damage_pct ?? 0,
    latest_decay_pct: li.values.decay_pct ?? 0,
    ripeness_stage: li.ripenessStage,
    storage_temp_c: t.temp,
    temp_from_logger: t.fromLogs,
    packaging: input.batch.handling.packaging,
    transport: input.batch.handling.transport,
    transit_hours: input.batch.handling.transitHours,
    precooled: input.batch.handling.precooled,
    supplier_decay_factor: input.supplier?.historicalDecayFactor ?? 1,
    inspection_count: input.inspections.filter((i) => i.batchId === input.batch.id).length,
  };
}

/** Calls the backend proxy for the SageMaker endpoint. Not used while VITE_AWS_MODE=demo. */
export async function invokeQualityForecast(features: SageMakerFeatureVector, token: string): Promise<Partial<QualityForecast>> {
  const res = await fetch(`${awsConfig.apiBaseUrl}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: awsConfig.sagemaker.endpointName, instances: [features] }),
  });
  if (!res.ok) throw new Error(`Forecast endpoint error ${res.status}`);
  return res.json();
}
