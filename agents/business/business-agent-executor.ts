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

export function executeBusinessAgent(input: BusinessAnalysisRequest): BusinessAgentExecutionResult {
  const route = routePromptToBusinessAgent(input.prompt);

  let analysis: BusinessAnalysisResult;

  switch (route.role) {
    case "website-audit-agent":
      analysis = auditWebsite(input);
      break;
    case "business-analyst-agent":
      analysis = analyzeBusinessIdea(input);
      break;
    case "market-analysis-agent":
      analysis = analyzeMarket(input);
      break;
    case "competitor-research-agent":
      analysis = analyzeCompetitors(input);
      break;
    case "seo-agent":
      analysis = analyzeSeo(input);
      break;
    case "marketing-agent":
      analysis = analyzeMarketing(input);
      break;
    case "offer-agent":
      analysis = buildOffer(input);
      break;
    case "proposal-agent":
      analysis = buildProposal(input);
      break;
    case "outreach-agent":
      analysis = buildOutreach(input);
      break;
    case "follow-up-agent":
      analysis = buildFollowUp(input);
      break;
    case "client-report-agent":
      analysis = buildClientReport(input);
      break;
    case "pricing-agent":
    case "research-agent":
    default:
      analysis = analyzeBusinessIdea(input);
      break;
  }

  return { route, analysis };
}
