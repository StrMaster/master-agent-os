import { openai } from "./openai";

export async function generateTaskPlan(
  prompt: string
) {
  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are an AI engineering task planner.

Your job:
- analyze user requests
- determine the best target file
- generate a short execution summary
- determine priority

Allowed target files:
- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
- app/agents/page.tsx

Respond ONLY valid JSON.

JSON format:
{
  "title": "...",
  "summary": "...",
  "targetFile": "...",
  "priority": "low|medium|high",
  "reasoning": "..."
}
          `,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  const content =
    response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "OpenAI returned empty response"
    );
  }

  return JSON.parse(content);
}