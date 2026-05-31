import type { BusinessAnalysisRequest, BusinessAnalysisResult } from "./types";

export function analyzeMarket(input: BusinessAnalysisRequest): BusinessAnalysisResult {
  return {
    agentRole: "market-analysis-agent",
    title: `Market Analysis: ${input.industry ?? input.goal ?? "Opportunity"}`,
    summary: "Evaluates demand, audience clarity, competition pressure and market timing before product or offer execution.",
    score: 72,
    strengths: [
      "Focuses on market demand before building new features.",
      "Helps decide whether an opportunity is worth deeper validation.",
      "Can feed competitor, pricing and offer agents with better context."
    ],
    problems: [
      "Market assumptions can be weak without external research or real customer conversations.",
      "A broad market does not automatically mean a reachable customer segment.",
      "High demand markets often come with stronger competition and higher acquisition costs."
    ],
    priorityActions: [
      "Define the narrow target segment.",
      "Identify the painful problem and urgency level.",
      "Check existing alternatives and buying behavior.",
      "Estimate if the customer can be reached through realistic channels.",
      "Decide whether to validate manually before building."
    ],
    recommendedNextStep: "Run competitor research and customer pain validation before creating a product or offer."
  };
}
