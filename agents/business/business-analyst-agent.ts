import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function analyzeBusinessIdea(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "business-analyst-agent",
    "You are a business analyst. Evaluate business potential, customer value proposition, monetization strategy, and execution risk. Be specific and data-driven.",
    input
  );
}
