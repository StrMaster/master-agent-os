import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function analyzeCompetitors(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "competitor-research-agent",
    "You are a competitor research specialist. Identify key competitors, their strengths and weaknesses, pricing, and market positioning gaps the business can exploit.",
    input
  );
}
