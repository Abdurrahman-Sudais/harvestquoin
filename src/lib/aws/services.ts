import { awsConfig } from "./config";
import type { Allocation, InspectionDocument } from "../types";

/** Amazon S3 — document & photo storage contract. */
export const s3 = {
  objectKey(batchId: string, fileName: string) {
    return `inspections/${batchId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  },
  /** Production: request a presigned PUT URL from the API, then upload directly to S3. */
  async presignUpload(_key: string, _contentType: string): Promise<{ url: string } | null> {
    return null; // demo mode — metadata only
  },
  describe(doc: InspectionDocument) {
    return `s3://${awsConfig.s3.bucket}/${doc.s3Key}`;
  },
};

/** AWS Lambda — allocation function contract. */
export interface AllocationLambdaRequest {
  operation: "recommend" | "approve" | "modify" | "reject";
  orderId?: string;
  batchId?: string;
  qtyKg?: number;
}
export interface AllocationLambdaResponse {
  ok: boolean;
  allocation?: Allocation;
  error?: string;
}

/**
 * Amazon DynamoDB — the approval path uses a conditional write on the
 * inventory ledger so concurrent approvals can never exceed available stock:
 *   ConditionExpression: "availableKg >= :qty"
 *   UpdateExpression:    "SET availableKg = availableKg - :qty"
 */
export const dynamoAllocationCondition = "availableKg >= :qty AND attribute_not_exists(lockedBy)";

/** Amazon CloudWatch — structured operational metrics (console in demo). */
export function emitMetric(name: string, value: number, dims: Record<string, string> = {}) {
  if (import.meta.env.DEV) console.debug(`[cloudwatch:demo] ${name}=${value}`, dims);
}
