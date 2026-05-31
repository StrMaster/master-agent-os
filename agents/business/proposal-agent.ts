import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function buildProposal(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "proposal-agent",
    title: `Proposal Builder: ${input.businessName ?? input.industry ?? "Client Proposal"}`,
    summary: "Turns an offer or audit into a structured client-facing proposal with scope, value and next steps.",
    score: 75,
    strengths: [
      "Transforms business analysis into a professional client document.",
      "Connects client problems to concrete deliverables.",
      "Creates a clearer path from audit to paid work."
    ],
    problems: [
      "A proposal is weak without a clear client problem and desired outcome.",
      "Too much technical detail can reduce buyer clarity.",
      "Unclear scope can create delivery risk later."
    ],
    priorityActions: [
      "Summarize the client problem.",
      "Describe the opportunity in business language.",
      "Define the recommended solution.",
      "List deliverables and exclusions clearly.",
      "End with one simple next step."
    ],
    recommendedNextStep: "Use outreach-agent or client-report-agent depending on whether this proposal is for first contact or post-audit delivery."
  };
}
