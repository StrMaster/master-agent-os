import { analyzeBusinessIdea } from "./business-analyst-agent";
import { analyzeCompetitors } from "./competitor-research-agent";
import { buildClientReport } from "./client-report-agent";
import { buildFollowUp } from "./follow-up-agent";
import { analyzeMarket } from "./market-analysis-agent";
import { analyzeMarketing } from "./marketing-agent";
import { buildOffer } from "./offer-agent";
import { buildOutreach } from "./outreach-agent";
import { buildProposal } from "./proposal-agent";
import { analyzeSeo } from "./seo-agent";
import type { BusinessAnalysisRequest, BusinessAnalysisResult, BusinessAgentRole } from "./types";
import { auditWebsite } from "./website-audit-agent";

export type BusinessWorkflowType =
  | "website-analysis"
  | "business-idea"
  | "marketing-review"
  | "client-acquisition"
  | "general-business-analysis";

export type BusinessWorkflowResult = {
  workflowType: BusinessWorkflowType;
  agentsExecuted: BusinessAgentRole[];
  results: BusinessAnalysisResult[];
  finalSummary: string;
  priorityActions: string[];
  recommendedNextStep: string;
};

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function selectBusinessWorkflow(prompt: string): BusinessWorkflowType {
  const text = prompt.toLowerCase();

  if (hasAny(text, ["website", "puslap", "svetain", "landing", "homepage", "ux", "seo", "cta", "conversion", "dizain", "design"])) {
    return "website-analysis";
  }

  if (hasAny(text, ["verslo idėja", "verslo ideja", "business idea", "saas", "startup", "produkt", "monetiz", "ai consultant"])) {
    return "business-idea";
  }

  if (hasAny(text, ["marketing", "hook", "positioning", "pozicion", "copy", "brand", "content", "žinut", "zinut"])) {
    return "marketing-review";
  }

  if (hasAny(text, ["lead", "client", "klient", "outreach", "proposal", "pasiūlym", "pasiulym", "follow-up", "follow up", "linkedin", "email"])) {
    return "client-acquisition";
  }

  return "general-business-analysis";
}

function summarizeWorkflow(workflowType: BusinessWorkflowType, results: BusinessAnalysisResult[]): string {
  const averageScore = Math.round(
    results.reduce((sum, result) => sum + (result.score ?? 70), 0) / Math.max(results.length, 1)
  );

  const workflowLabels: Record<BusinessWorkflowType, string> = {
    "website-analysis": "Website analysis workflow completed",
    "business-idea": "Business idea workflow completed",
    "marketing-review": "Marketing review workflow completed",
    "client-acquisition": "Client acquisition workflow completed",
    "general-business-analysis": "General business analysis workflow completed",
  };

  return `${workflowLabels[workflowType]}. Combined confidence score: ${averageScore}/100. Results are preliminary and based on the provided prompt/context only.`;
}

function mergePriorityActions(results: BusinessAnalysisResult[]): string[] {
  const actions = results.flatMap((result) => result.priorityActions);
  return Array.from(new Set(actions)).slice(0, 8);
}

export function executeBusinessWorkflow(input: BusinessAnalysisRequest): BusinessWorkflowResult {
  const workflowType = selectBusinessWorkflow(input.prompt);

  let results: BusinessAnalysisResult[];

  switch (workflowType) {
    case "website-analysis":
      results = [
        auditWebsite(input),
        analyzeSeo(input),
        analyzeMarketing(input),
        buildClientReport(input),
      ];
      break;
    case "business-idea":
      results = [
        analyzeBusinessIdea(input),
        analyzeMarket(input),
        analyzeCompetitors(input),
        buildOffer(input),
      ];
      break;
    case "marketing-review":
      results = [
        analyzeMarketing(input),
        buildOffer(input),
        buildOutreach(input),
      ];
      break;
    case "client-acquisition":
      results = [
        buildOffer(input),
        buildProposal(input),
        buildOutreach(input),
        buildFollowUp(input),
      ];
      break;
    case "general-business-analysis":
    default:
      results = [
        analyzeBusinessIdea(input),
        analyzeMarket(input),
        analyzeMarketing(input),
      ];
      break;
  }

  return {
    workflowType,
    agentsExecuted: results.map((result) => result.agentRole),
    results,
    finalSummary: summarizeWorkflow(workflowType, results),
    priorityActions: mergePriorityActions(results),
    recommendedNextStep: results.at(-1)?.recommendedNextStep ?? "Review the analysis and choose the next approved action.",
  };
}
