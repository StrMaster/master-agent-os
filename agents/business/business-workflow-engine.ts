import { fetchWebsite, type FetchedWebsite } from "@/lib/website/fetch-website";
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
  website?: FetchedWebsite;
};

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function extractUrlFromPrompt(prompt: string): string | undefined {
  const match = prompt.match(/https?:\/\/[^\s)]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/i);
  return match?.[0];
}

function buildWebsiteContext(website?: FetchedWebsite): string {
  if (!website) {
    return "";
  }

  if (website.error) {
    return `Website fetch failed. URL: ${website.url}. Error: ${website.error}`;
  }

  return [
    `Fetched website URL: ${website.finalUrl}`,
    `HTTP status: ${website.status}`,
    `Title: ${website.title}`,
    `Meta description: ${website.metaDescription}`,
    `Headings: ${website.headings.join(" | ")}`,
    `Visible text: ${website.textContent}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function selectBusinessWorkflow(prompt: string): BusinessWorkflowType {
  const text = prompt.toLowerCase();

  if (hasAny(text, ["website", "puslap", "svetain", "landing", "homepage", "ux", "seo", "cta", "conversion", "dizain", "design"])) {
    return "website-analysis";
  }

  if (extractUrlFromPrompt(prompt)) {
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

function summarizeWorkflow(workflowType: BusinessWorkflowType, results: BusinessAnalysisResult[], website?: FetchedWebsite): string {
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

  const dataSource = website
    ? website.error
      ? "Website fetch was attempted but failed, so the result may be incomplete."
      : `Website content was fetched from ${website.finalUrl}.`
    : "Results are preliminary and based on the provided prompt/context only.";

  return `${workflowLabels[workflowType]}. Combined confidence score: ${averageScore}/100. ${dataSource}`;
}

function mergePriorityActions(results: BusinessAnalysisResult[]): string[] {
  const actions = results.flatMap((result) => result.priorityActions);
  return Array.from(new Set(actions)).slice(0, 8);
}

export async function executeBusinessWorkflow(input: BusinessAnalysisRequest): Promise<BusinessWorkflowResult> {
  const workflowType = selectBusinessWorkflow(input.prompt);
  const url = input.url ?? extractUrlFromPrompt(input.prompt);
  const website = workflowType === "website-analysis" && url ? await fetchWebsite(url) : undefined;
  const websiteContext = buildWebsiteContext(website);
  const enrichedInput: BusinessAnalysisRequest & { pageContent?: string } = {
    ...input,
    url,
    prompt: websiteContext ? `${input.prompt}\n\n${websiteContext}` : input.prompt,
    pageContent: websiteContext,
  };

  let results: BusinessAnalysisResult[];

  switch (workflowType) {
    case "website-analysis":
      results = [
        auditWebsite(enrichedInput),
        analyzeSeo(enrichedInput),
        analyzeMarketing(enrichedInput),
        buildClientReport(enrichedInput),
      ];
      break;
    case "business-idea":
      results = [
        analyzeBusinessIdea(enrichedInput),
        analyzeMarket(enrichedInput),
        analyzeCompetitors(enrichedInput),
        buildOffer(enrichedInput),
      ];
      break;
    case "marketing-review":
      results = [
        analyzeMarketing(enrichedInput),
        buildOffer(enrichedInput),
        buildOutreach(enrichedInput),
      ];
      break;
    case "client-acquisition":
      results = [
        buildOffer(enrichedInput),
        buildProposal(enrichedInput),
        buildOutreach(enrichedInput),
        buildFollowUp(enrichedInput),
      ];
      break;
    case "general-business-analysis":
    default:
      results = [
        analyzeBusinessIdea(enrichedInput),
        analyzeMarket(enrichedInput),
        analyzeMarketing(enrichedInput),
      ];
      break;
  }

  return {
    workflowType,
    agentsExecuted: results.map((result) => result.agentRole),
    results,
    finalSummary: summarizeWorkflow(workflowType, results, website),
    priorityActions: mergePriorityActions(results),
    recommendedNextStep: results.at(-1)?.recommendedNextStep ?? "Review the analysis and choose the next approved action.",
    website,
  };
}
