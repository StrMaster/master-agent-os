export type ProductHunterSourceId =
  | "google-trends"
  | "tiktok-creative-center"
  | "meta-ad-library"
  | "amazon-marketplace"
  | "supplier-catalog"
  | "public-reviews";

export type ProductHunterSource = {
  id: ProductHunterSourceId;
  name: string;
  purpose: string;
  access: "public_signals" | "supplier_data";
  state: "not_connected";
  note: string;
};

/**
 * Source inventory for the first Product Hunter milestone.
 * These entries describe intended inputs only; they do not imply live access.
 */
export const productHunterSources: ProductHunterSource[] = [
  {
    id: "google-trends",
    name: "Google Trends",
    purpose: "Compare search interest over time and by market",
    access: "public_signals",
    state: "not_connected",
    note: "Google's official Trends API is limited alpha access; a supported alternative must be selected if access is unavailable.",
  },
  {
    id: "tiktok-creative-center",
    name: "TikTok Creative Center",
    purpose: "Find rising products, creatives and public trend signals",
    access: "public_signals",
    state: "not_connected",
    note: "The public Creative Center is useful for research; do not assume a general-purpose data API is available.",
  },
  {
    id: "meta-ad-library",
    name: "Meta Ad Library",
    purpose: "Review publicly visible ads and advertiser activity",
    access: "public_signals",
    state: "not_connected",
    note: "The official API has geographic and ad-category limits; it is not a US-wide commercial-ad research feed.",
  },
  {
    id: "amazon-marketplace",
    name: "Amazon Marketplace",
    purpose: "Compare visible listings, prices and review signals",
    access: "public_signals",
    state: "not_connected",
    note: "Seller APIs do not automatically provide broad competitor research; choose a permitted marketplace data source.",
  },
  {
    id: "supplier-catalog",
    name: "Supplier Catalog",
    purpose: "Verify product cost, stock, shipping cost and delivery estimates",
    access: "supplier_data",
    state: "not_connected",
    note: "Supplier data must be checked against the destination market.",
  },
  {
    id: "public-reviews",
    name: "Public Reviews and Comments",
    purpose: "Collect recurring praise, complaints and product objections",
    access: "public_signals",
    state: "not_connected",
    note: "Quality Analyst will interpret review evidence after collection is connected.",
  },
];

export function getProductHunterReadiness() {
  return {
    phase: "source_setup",
    canRunLiveSearch: false,
    liveDataConnected: false,
    currentCapabilities: [
      "Niche profile and product rules are available.",
      "The internal product scoring endpoint is available for supplied evidence.",
    ],
    blockers: [
      "No market research source adapter is connected.",
      "No supplier data source is connected.",
      "No AI model access or durable research-job storage is configured.",
    ],
    requiredSetup: [
      {
        id: "market-research-provider",
        label: "Select a market research provider and approve its price before purchase.",
        state: "not_selected",
      },
      {
        id: "supplier-provider",
        label: "Select how supplier cost, stock and delivery estimates will be verified.",
        state: "not_selected",
      },
      {
        id: "model-access",
        label: "Configure model access for evidence summaries and review analysis.",
        state: "not_configured",
      },
      {
        id: "research-storage",
        label: "Configure durable storage for research jobs, source evidence and reports.",
        state: "not_configured",
      },
    ],
    sources: productHunterSources,
    dataPolicy: {
      evidenceRequired: true,
      eachClaimNeedsSourceUrl: true,
      eachObservationNeedsTimestamp: true,
      markMissingEvidence: true,
      useSyntheticLiveData: false,
    },
  } as const;
}
