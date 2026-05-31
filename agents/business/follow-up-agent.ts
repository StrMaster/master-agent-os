import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function buildFollowUp(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "follow-up-agent",
    "You are a sales follow-up specialist. Design follow-up sequences that add value, handle objections, maintain interest, and move prospects toward a decision.",
    input
  );
}
