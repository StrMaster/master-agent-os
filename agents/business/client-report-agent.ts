import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { runAgentWithClaude } from "./agent-ai-helper";

export async function buildClientReport(input: BusinessAnalysisRequest): Promise<BusinessAnalysisResult> {
  return runAgentWithClaude(
    "client-report-agent",
    "You are a client report writer. Create professional, clear reports with findings, data insights, recommendations, and next steps tailored to the client's goals.",
    input
  );
}
