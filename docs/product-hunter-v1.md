# Product Hunter v1

## Goal

Find and compare product candidates for the active Global Wellness & Better Living niche. Start with the United States and the active categories Sleep & Recovery, Strength & Mobility, and Smart Wellness. Keep the existing niche rules as the hard filter.

A candidate report must distinguish verified facts, estimates, and missing information. Do not show simulated or sample values as live research.

## Research workflow

1. Create a research job with market, category and a bounded search window.
2. Discover candidates from selected public market sources.
3. Gather evidence for demand, competition, market price, supplier cost, delivery, quality, audience and customer feedback.
4. Attach a source URL and observation timestamp to each evidence item.
5. Run the hard niche filters and product scoring.
6. Send review and comment evidence to Quality Analyst for recurring praise, complaints and return-risk signals.
7. Save a report with confidence, source coverage, missing evidence and a human-review decision.

## Source inventory and limits

| Source | Intended evidence | Current access constraint |
| --- | --- | --- |
| Google Trends | Search-interest direction and market comparison | Google's official Trends API is limited alpha access. Do not assume the project will be accepted. |
| TikTok Creative Center | Public products, creatives and trend signals | The public Creative Center is available for research; a general-purpose data API is not assumed. |
| Meta Ad Library | Public ads and advertiser activity | The official API's scope is limited by geography and ad category. It is not a US-wide commercial-ad research feed. |
| Amazon Marketplace | Visible listings, prices and review signals | Seller APIs are not automatically broad competitor-research feeds. Use a permitted market-data source. |
| Supplier catalog | Product cost, stock, shipping cost and delivery estimate | Supplier access is required; delivery must be checked for the destination market. |
| Public reviews and comments | Repeated praise, complaints and objections | Quality Analyst interprets evidence after a permitted collection method is connected. |

The source inventory and /api/product-hunter readiness response are planning scaffolding. No source adapter is connected yet, so the endpoint reports canRunLiveSearch=false. Where a platform does not provide a suitable direct API, compare a third-party data provider or a human-assisted research step; do not silently scrape or present unsupported coverage as complete.

## Existing niche gates

- Adult audience: 18+; evaluate the defined age segments separately.
- Target gross margin: 70%; reject below 60%.
- Preferred delivery: up to 14 days; reject above 21 days.
- Preferred selling price: USD 35–150.
- Exclude unsupported health claims, regulated medical products, ingestibles without a clear compliance basis, counterfeit or protected-brand products, and high defect or return risk.
- Stress & Focus remains a later-phase category.

## Report requirements

Every report should include:

- Candidate and category, target market and audience segments.
- Demand, competition, sale-price range and supplier quotation.
- Landed cost and gross-margin calculation.
- Delivery estimate and destination.
- Evidence links and observation times.
- Customer comment themes, with sample size and collection source.
- Compliance, quality, return and advertising risks.
- Confidence and coverage score, missing fields, and reasons for the recommendation.
- Explicit distinction between observed data, estimates and analysis.

## Setup needed before live runs

1. Compare source providers that can cover the US market and review their price, terms and limitations.
2. Select the supplier source and confirm it can return destination-specific cost and delivery estimates.
3. Configure model access for evidence summaries and comment analysis.
4. Add durable storage and a retryable job runner before enabling longer research runs.
5. Add providers as server-side adapters; keep all credentials in deployment secrets.

No paid provider should be enabled until its exact role and cost are presented for approval. Public ad research must remain separate from the user's private advertising account data.
