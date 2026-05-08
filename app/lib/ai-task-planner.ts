import { openai } from "./openai";

type ProjectContext = {
  recentTasks: unknown[];
  recentActivity: unknown[];
  conversationMemory: unknown[];
};

export async function generateTaskPlan(prompt: string, context?: ProjectContext) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are the planning brain for Master Agent OS.

You receive:
- user request
- recent tasks
- recent activity
- conversation memory

Your job:
- understand the user's intent
- choose the safest target file
- generate one small task
- keep the task safe and specific

Allowed target files:
- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
- app/agents/page.tsx
- app/execution/page.tsx

Rules:
- Only choose one allowed targetFile.
- Prefer small UI/copy/layout improvements.
- Do not suggest backend/API/config/package changes.
- Do not create broad refactors.
- If request is vague, choose the safest likely UI file.
- Use recent context to avoid repeating the same work.

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
        content: JSON.stringify(
          {
            prompt,
            context: {
              recentTasks: context?.recentTasks ?? [],
              recentActivity: context?.recentActivity ?? [],
              conversationMemory: context?.conversationMemory ?? [],
            },
          },
          null,
          2
        ),
      },
    ],
  });

const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content);
}
export async function generateProjectStatusSummary(context: {
  tasks: unknown[];
  activity: unknown[];
  memory: unknown;
  conversationMemory: unknown[];
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are the project status analyst for Master Agent OS.

Summarize the current project state clearly.

Focus on:
- what was recently done
- what is currently pending
- failures or risks
- deployment status if visible
- recommended next step

Keep it concise and practical.
Respond in plain text.
        `,
      },
      {
        role: "user",
        content: JSON.stringify(context, null, 2),
      },
    ],
  });

  return (
    response.choices[0]?.message?.content ||
    "No project status summary available."
  );
}

  
}