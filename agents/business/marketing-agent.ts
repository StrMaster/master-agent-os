import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function analyzeMarketing(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "marketing-agent",
    "You are a marketing strategist. Evaluate marketing channels, messaging, positioning, customer acquisition strategies, and conversion opportunities.",
    input
  );
}
