import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function buildOutreach(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "outreach-agent",
    title: `Outreach Strategy: ${input.businessName ?? "Lead Outreach"}`,
    summary: "Creates first-contact outreach strategy for email, LinkedIn, Instagram and direct prospecting.",
    score: 76,
    strengths: [
      "Focuses on relevance before selling.",
      "Encourages short, professional communication.",
      "Works well with website audits and business reports."
    ],
    problems: [
      "Generic outreach messages often get ignored.",
      "Long messages create friction.",
      "No clear next step reduces response rates."
    ],
    priorityActions: [
      "Personalize the opening line.",
      "Reference a real business observation.",
      "Present one clear opportunity.",
      "Keep the message concise.",
      "End with a simple call to action."
    ],
    recommendedNextStep: "Use follow-up-agent to prepare the next contact sequence if no response is received."
  };
}
