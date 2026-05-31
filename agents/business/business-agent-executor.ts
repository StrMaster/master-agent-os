import { routePromptToBusinessAgent } from "./business-agent-router";
import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";
import { auditWebsite } from "./website-audit-agent";
import { analyzeBusinessIdea } from "./business-analyst-agent";
import { analyzeMarket } from "./market-analysis-agent";
import { analyzeCompetitors } from "./competitor-research-agent";
import { analyzeSeo } from "./seo-agent";
import { analyzeMarketing } from "./marketing-agent";
import { buildOffer } from "./offer-agent";
import { buildProposal } from "./proposal-agent";
import { buildOutreach } from "./outreach-agent";
import { buildFollowUp } from "./follow-up-agent";
import { buildClientReport } from "./client-report-agent";

export type BusinessAgentExecutionResult = {
  route: ReturnType<typeof routePromptToBusinessAgent>;
  analysis: BusinessAnalysisResult;
};

export async function executeBusinessAgent(input: BusinessAnalysisRequest): Promise<BusinessAgentExecutionResult> {
  const route = routePromptToBusinessAgent(input.prompt);

  let analysis: BusinessAnalysisResult;

  switch (route.role) {
    case "website-audit-agent":
      analysis = await auditWebsite(input);
      break;
    case "business-analyst-agent":
      analysis = await analyzeBusinessIdea(input);
      break;
    case "market-analysis-agent":
      analysis = await analyzeMarket(input);
      break;
    case "competitor-research-agent":
      analysis = await analyzeCompetitors(input);
      break;
    case "seo-agent":
      analysis = await analyzeSeo(input);
      break;
    case "marketing-agent":
      analysis = await analyzeMarketing(input);
      break;
    case "offer-agent":
      analysis = await buildOffer(input);
      break;
    case "proposal-agent":
      analysis = await buildProposal(input);
      break;
    case "outreach-agent":
      analysis = await buildOutreach(input);
      break;
    case "follow-up-agent":
      analysis = await buildFollowUp(input);
      break;
    case "client-report-agent":
      analysis = await buildClientReport(input);
      break;
    case "pricing-agent":
    case "research-agent":
    default:
      analysis = await analyzeBusinessIdea(input);
      break;
  }

  return { route, analysis };
}
