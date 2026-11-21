# HarvestQuoin

**Plan dispatch around produce quality.**

HarvestQuoin is an agricultural supply chain intelligence platform for produce aggregators, packing houses, cooperatives and fresh-food wholesalers. It connects inspection records, handling conditions, inventory and buyer requirements to recommend which batches should be dispatched, to whom, and when.

Founders: **Oluwaseun Adeyemi** (Founder) · **Hauwa Musa** (Co-founder)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npx tsx scripts/check-engine.ts   # prints forecasts, recommendations, priorities for the seed data
```

Sign in with **Continue with demo account** (any email + 8-character password also works — auth is simulated).

## Workflow

1. **Register produce batches** — `/app/batches`
2. **Record inspections** — `/app/inspections/new` (configurable criteria, photos, documents, AI note structuring)
3. **Forecast quality changes** — `/app/forecasting` (clearly labelled simulated forecasts)
4. **Create customer orders** — `/app/orders`
5. **Recommend batch allocations** — `/app/allocation` (approve / modify / reject)
6. **Approve dispatch** — `/app/dispatch` (priority queue, calendar, schedule, status tracking)

Plus the AI inspection assistant (`/app/assistant`), reports with PDF/CSV export (`/app/reports`) and grading configuration + AWS architecture (`/app/settings`).

## Determinism & accuracy

- All quantities are integer kilograms. One ledger per batch (`src/lib/engine/inventory.ts`):
  `net = arrival − culled`, `available = net − approved allocations`, `on hand = net − dispatched`.
- `validateAllocation` guards every approve/modify against available stock **and** the order's remaining need.
- The recommendation engine (`src/lib/engine/allocation.ts`) processes orders by delivery date and decrements tentative availability, so two orders are never recommended the same kilograms. Ties break on batch code.
- All calculations use a fixed **operating date** (top bar) so results are reproducible; it can be advanced to simulate time.

## Simulated AI — clearly labelled

- **Quality forecasting** (`src/lib/engine/forecast.ts`): `SimulatedForecastProvider` implements `QualityForecastProvider`. Inspection grades and predicted grades are always displayed separately; predicted grades use dashed badges and a "Simulated forecast" tag and are never presented as inspection results or shelf-life guarantees.
- **AI assistant** (`src/lib/aws/bedrock.ts`): rule-based mock of Amazon Bedrock; every response is tagged "Mock AI response". `promptFor()` shows the production prompt.

## AWS architecture (prepared adapters in `src/lib/aws/`)

| Service | Role | Demo status |
|---|---|---|
| Amazon SageMaker AI | Quality forecasting (`sagemaker.ts` feature vector + invoke) | Simulated |
| Amazon Bedrock | Note normalisation, summaries | Mock |
| Amazon S3 | Batch datasets, photos, documents (`services.ts` key scheme) | Metadata only |
| Amazon DynamoDB | Batches, orders, inventory ledger (conditional writes) | localStorage |
| AWS Lambda | Allocation recommendations | Same engine in-browser |
| Amazon Cognito | Authentication (`auth.tsx`) | Local session |
| Amazon CloudWatch | Metrics (`emitMetric`) | Console |

Configure via `VITE_AWS_MODE`, `VITE_API_BASE_URL`, `VITE_AWS_REGION`, `VITE_COGNITO_*`, `VITE_SAGEMAKER_ENDPOINT`, `VITE_BEDROCK_MODEL_ID`, `VITE_S3_BUCKET`.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui (Radix) · React Router · Lucide · Recharts · React Hook Form + Zod · jsPDF.
