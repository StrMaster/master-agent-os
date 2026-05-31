import Anthropic from "@anthropic-ai/sdk";
import type { BusinessAnalysisRequest, BusinessAnalysisResult, BusinessAgentRole } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runAgentWithClaude(
  agentRole: BusinessAgentRole,
  systemPrompt: string,
  input: BusinessAnalysisRequest,
  extraContext?: string
): Promise<BusinessAnalysisResult> {
  const userMessage = [
    `Business: ${input.businessName ?? "Unknown"}`,
    input.url ? `Website: ${input.url}` : "",
    input.industry ? `Industry: ${input.industry}` : "",
    input.targetCustomer ? `Target customer: ${input.targetCustomer}` : "",
    input.goal ? `Goal: ${input.goal}` : "",
    `Request: ${input.prompt}`,
    extraContext ? `\nContext:\n${extraContext}` : "",
  ].filter(Boolean).join("\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: `${systemPrompt}

Return ONLY valid JSON matching this exact structure (no markdown):
{
  "title": "short title",
  "summary": "2-3 sentence summary",
  "score": 0-100,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "problems": ["problem 1", "problem 2"],
  "priorityActions": ["action 1", "action 2", "action 3"],
  "recommendedNextStep": "one clear next step"
}`,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text : "{}";

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Omit<BusinessAnalysisResult, "agentRole">;
    return { ...parsed, agentRole };
  } catch {
    return {
      agentRole,
      title: `Analysis: ${input.businessName ?? input.prompt.slice(0, 40)}`,
      summary: raw.slice(0, 200),
      score: 70,
      strengths: ["Analysis completed"],
      problems: ["Could not parse structured response"],
      priorityActions: ["Review the summary above"],
      recommendedNextStep: "Proceed with manual review",
    };
  }
}
