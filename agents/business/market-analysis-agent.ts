import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function analyzeMarket(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "market-analysis-agent",
    "You are a market analyst. Assess market size, demand signals, growth trends, customer segments, and timing. Use specific market data when available.",
    input
  );
}
