import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function buildOffer(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "offer-agent",
    title: `Offer Builder: ${input.businessName ?? input.industry ?? "Client Offer"}`,
    summary: "Creates a clear client offer from customer pain, outcome, deliverables and pricing logic.",
    score: 74,
    strengths: [
      "Turns analysis into a sellable package.",
      "Clarifies the promise, deliverables and next step.",
      "Helps avoid vague service descriptions that do not convert."
    ],
    problems: [
      "An offer is weak if the target customer and pain are unclear.",
      "Too many deliverables can make the offer confusing.",
      "Pricing should match perceived value, not only time spent."
    ],
    priorityActions: [
      "Define the exact target customer.",
      "State the painful problem in simple language.",
      "Define the promised business outcome.",
      "List 3-5 concrete deliverables.",
      "Add a clear next step or low-friction call to action."
    ],
    recommendedNextStep: "Use proposal-agent to turn this offer into a client-facing proposal."
  };
}
