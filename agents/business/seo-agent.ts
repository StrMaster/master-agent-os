import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function analyzeSeo(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "seo-agent",
    "You are an SEO specialist. Analyze keyword opportunities, on-page optimization, content gaps, technical SEO issues, and link building strategies for the given business.",
    input
  );
}
