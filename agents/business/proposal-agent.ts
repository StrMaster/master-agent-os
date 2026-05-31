import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function buildProposal(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "proposal-agent",
    "You are a business proposal writer. Create structured, persuasive proposals with clear problem statements, solutions, ROI projections, and calls to action.",
    input
  );
}
