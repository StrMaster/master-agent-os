import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function buildOffer(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "offer-agent",
    "You are an offer strategist. Create compelling, specific offer structures with pricing tiers, bundles, guarantees, and bonuses that maximize perceived value and conversion.",
    input
  );
}
