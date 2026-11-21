/**
 * AWS integration configuration.
 *
 * The frontend demo runs entirely in the browser with simulated services.
 * Each AWS service has an adapter module in this folder that defines the
 * contract the production backend implements. Flip `VITE_AWS_MODE=live`
 * and supply endpoints to route calls through API Gateway instead.
 */
export type AwsMode = "demo" | "live";

export const awsConfig = {
  mode: (import.meta.env.VITE_AWS_MODE as AwsMode) || "demo",
  region: import.meta.env.VITE_AWS_REGION || "eu-west-1",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  },
  sagemaker: { endpointName: import.meta.env.VITE_SAGEMAKER_ENDPOINT || "harvestquoin-quality-forecast" },
  bedrock: { modelId: import.meta.env.VITE_BEDROCK_MODEL_ID || "anthropic.claude-sonnet-5-5" },
  s3: { bucket: import.meta.env.VITE_S3_BUCKET || "harvestquoin-batch-data" },
  dynamodb: {
    tables: {
      batches: "hq-batches",
      inspections: "hq-inspections",
      orders: "hq-orders",
      allocations: "hq-allocations",
      inventoryLedger: "hq-inventory-ledger",
    },
  },
};

export const isLive = () => awsConfig.mode === "live" && !!awsConfig.apiBaseUrl;

export interface AwsServiceInfo {
  key: string;
  service: string;
  role: string;
  status: "simulated" | "prepared";
  detail: string;
}

export const AWS_SERVICES: AwsServiceInfo[] = [
  { key: "sagemaker", service: "Amazon SageMaker AI", role: "Produce quality forecasting", status: "simulated", detail: "Real-time endpoint scores batch features (inspection, temperature, handling, supplier history). Demo uses a deterministic in-browser simulator with the same contract." },
  { key: "bedrock", service: "Amazon Bedrock", role: "Inspection note normalisation & summaries", status: "simulated", detail: "Foundation model structures free-text notes, summarises reports and drafts dispatch recommendations. Demo returns labelled mock responses." },
  { key: "s3", service: "Amazon S3", role: "Batch datasets & uploaded documents", status: "prepared", detail: "Inspection photos and documents are keyed as inspections/{batchId}/{file}. Demo stores metadata locally." },
  { key: "dynamodb", service: "Amazon DynamoDB", role: "Inventory, batches & customer orders", status: "prepared", detail: "Single-region tables with conditional writes on the inventory ledger to prevent over-allocation. Demo persists to localStorage." },
  { key: "lambda", service: "AWS Lambda", role: "Allocation recommendations & processing", status: "prepared", detail: "Allocation engine runs as a function triggered by order/inspection changes. Demo runs the identical deterministic engine in-browser." },
  { key: "cognito", service: "Amazon Cognito", role: "Authentication", status: "simulated", detail: "User pools with organisation and role claims (manager, inspector, viewer). Demo uses a local session." },
  { key: "cloudwatch", service: "Amazon CloudWatch", role: "Monitoring", status: "prepared", detail: "Structured logs and metrics for forecast latency, allocation decisions and dispatch SLA. Demo logs to the browser console." },
];
