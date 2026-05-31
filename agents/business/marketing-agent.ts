import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function analyzeMarketing(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "marketing-agent",
    title: `Marketing Analysis: ${input.businessName ?? input.industry ?? "Offer"}`,
    summary: "Reviews positioning, message clarity, hooks, objections and conversion communication.",
    score: 73,
    strengths: [
      "Focuses on customer problem and value communication.",
      "Can turn audits into clearer landing page messaging.",
      "Supports outreach, offers and proposals with consistent positioning."
    ],
    problems: [
      "Weak positioning makes even good products hard to sell.",
      "Generic messaging creates low trust and weak conversion.",
      "CTA and offer copy often fail when customer pain is unclear."
    ],
    priorityActions: [
      "Define the target customer in one sentence.",
      "Write the main problem in the customer's language.",
      "Create a clear promise without overclaiming.",
      "Add proof, examples or credibility signals.",
      "Align CTA with the lowest-friction next step."
    ],
    recommendedNextStep: "Use marketing analysis before creating website copy, offers or outreach messages."
  };
}
