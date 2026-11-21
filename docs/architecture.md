# HarvestQuoin — planned AWS architecture

HarvestQuoin connects inspection records, handling conditions, inventory and buyer requirements for produce aggregators, packing houses, cooperatives and wholesalers. Produce quality changes daily, so forecasts and allocations must be recalculated quickly and stored as an accurate ledger. Designing on AWS lets it host forecasting models, structure inspection notes and process allocations reliably at harvest-season volumes.

This is a proposed design; the demo runs in the browser with simulated AI and fictional data.

## Stages


## Services

| Service | Role |
|---|---|
| Amazon DynamoDB | Amazon CloudWatch |
| Amazon Cognito | handles sign-in and roles |
| AWS Lambda | runs allocation processing |
| AWS KMS | encrypts business data |
| Amazon CloudWatch | monitors services |

## Principles

- The browser never holds AWS credentials; all calls go through the API with Cognito-issued tokens.
- AI output is labelled and reviewed by people before it changes any decision or record.
- Data is encrypted at rest with KMS and access is logged.
