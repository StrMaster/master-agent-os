import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function buildClientReport(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "client-report-agent",
    title: `Client Report: ${input.businessName ?? input.url ?? input.industry ?? "Business Review"}`,
    summary: "Turns audit, research and business findings into a clear client-facing report with priorities and next steps.",
    score: 77,
    strengths: [
      "Packages technical and business findings into a format clients can understand.",
      "Prioritizes practical actions instead of overwhelming the client.",
      "Can combine website audit, SEO, marketing and offer findings into one deliverable."
    ],
    problems: [
      "A report is weak if it only lists problems without business impact.",
      "Too much technical detail can reduce client clarity.",
      "Recommendations should be prioritized to avoid confusing the next step."
    ],
    priorityActions: [
      "Start with a short executive summary.",
      "Group findings by business impact: trust, conversion, SEO, offer clarity and user experience.",
      "Highlight the top 3 priority fixes.",
      "Explain why each fix matters commercially.",
      "End with a clear recommended next action."
    ],
    recommendedNextStep: "Use proposal-agent if the report should become a paid project proposal."
  };
}
