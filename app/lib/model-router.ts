import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ModelRole =
  | "planner"       // task planning, decomposition
  | "executor"      // code patch generation
  | "reviewer"      // code review, safety checks
  | "analyst"       // status summaries, improvement suggestions
  | "recovery";     // recovery planning

const MODEL_MAP: Record<ModelRole, string> = {
  planner: "claude-haiku-4-5-20251001",
  executor: "claude-haiku-4-5-20251001",
  reviewer: "claude-haiku-4-5-20251001",
  analyst: "claude-haiku-4-5-20251001",
  recovery: "claude-haiku-4-5-20251001",
};

export async function callModel(
  role: ModelRole,
  system: string,
  userContent: string,
  maxTokens = 512
): Promise<string> {
  const model = MODEL_MAP[role];

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return text.replace(/```json|```/g, "").trim();
}

export function getModelForRole(role: ModelRole): string {
  return MODEL_MAP[role];
}
