// Site facts used by the marketing kit (forms, AWS section, progress, motion). A proposed product:
// AWS services and integrations are planned until implemented and verified.
type Stage = readonly [string, readonly string[], string];
type Pair = readonly [string, string];
type Stat = readonly [number, string, string?, string?];
export type Site = {
  name: string; email: string; founder: string;
  orgLabel: string; orgTypes: readonly string[]; useCases: readonly string[]; topics: readonly string[];
  detailLabel: string; detailProp: string; detailPlaceholder: string;
  demoTitle: string; demoIntro: string;
  progress: readonly (readonly [string, string, string])[];
  cycle: readonly string[]; marquee: readonly string[]; stats: readonly Stat[];
  aws: { why: string; stages: readonly Stage[]; across: readonly Pair[]; services: readonly Pair[] };
};

export const SITE: Site = {
  name: "HarvestQuoin", email: "oluwaseun@harvestquoin.site", founder: "Oluwaseun Adeyemi",
  orgLabel: "Business type", orgTypes: ["Produce aggregator", "Packing house", "Cooperative", "Fresh-food wholesaler", "Other"],
  useCases: ["Inspection records", "Quality forecasting", "Order allocation", "Dispatch planning", "Reports and traceability", "Other"],
  topics: ["Pilot programme", "Pricing", "Technical / AWS deployment", "Data and integrations", "Partnership", "Other"],
  detailLabel: "Produce and volume", detailProp: "produce_detail", detailPlaceholder: "e.g. tomatoes and peppers · ~40 tonnes a week · 2 warehouses",
  demoTitle: "See dispatch planned around quality.", demoIntro: "HarvestQuoin is a proposed product in its building stage. A demo walks through batch registration, inspections, labelled quality forecasts, allocation recommendations and dispatch approval on fictional produce data.",
  progress: [["2026", "Company founded", "By Oluwaseun Adeyemi, to help produce businesses plan dispatch around quality."], ["Done", "Allocation method defined", "One inventory ledger per batch, labelled forecasts, recommendations approved by warehouse managers."], ["Done", "Working product demo", "Batches, inspections, forecasts, orders, allocations, dispatch and reports on fictional data."], ["Done", "AWS reference architecture", "Forecasting, note structuring, storage, allocation processing and monitoring designed."], ["Next", "First pilots", "Fresh tomatoes at one packing house, with managers approving every allocation."]],
  cycle: ["produce aggregators", "packing houses", "cooperatives", "fresh-food wholesalers"],
  marquee: ["Fresh tomatoes", "Packing houses", "Cooperatives", "Aggregators", "Wholesalers", "Inspections", "Ripeness stages", "Grading", "Quality forecasts", "Allocation", "Dispatch", "Traceability"],
  stats: [[8, "suppliers in the demo dataset"], [3, "warehouses with one stock ledger each"], [8, "configurable inspection criteria"], [6, "ripeness stages tracked"]],
  aws: {
    why: "HarvestQuoin connects inspection records, handling conditions, inventory and buyer requirements for produce aggregators, packing houses, cooperatives and wholesalers. Produce quality changes daily, so forecasts and allocations must be recalculated quickly and stored as an accurate ledger. Designing on AWS lets it host forecasting models, structure inspection notes and process allocations reliably at harvest-season volumes.",
    stages: [["Capture", ["Amazon S3"], "Batch datasets, inspection photos and documents are stored securely."], ["Structure", ["Amazon Bedrock"], "Inspection notes are normalised and summarised for review."], ["Forecast", ["Amazon SageMaker AI"], "Quality forecasts estimate how each batch will change, clearly labelled as forecasts."], ["Allocate", ["AWS Lambda"], "Allocation recommendations match batches to orders without double-counting stock."], ["Ledger & monitor", ["Amazon DynamoDB", "Amazon CloudWatch"], "Batches, orders and the inventory ledger are stored with conditional writes; metrics are monitored."]],
    across: [["Amazon Cognito", "handles sign-in and roles"], ["AWS Lambda", "runs allocation processing"], ["AWS KMS", "encrypts business data"], ["Amazon CloudWatch", "monitors services"]],
    services: [["Amazon SageMaker AI", "Forecasts quality changes for each batch."], ["Amazon Bedrock", "Normalises inspection notes and drafts summaries."], ["Amazon S3", "Stores batch datasets, photos and documents."], ["Amazon DynamoDB", "Stores batches, orders and the inventory ledger."], ["AWS Lambda", "Computes allocation recommendations."], ["Amazon Cognito", "Authenticates users."], ["Amazon CloudWatch", "Monitors metrics and services."], ["AWS KMS", "Encrypts business data."]],
  },
};
