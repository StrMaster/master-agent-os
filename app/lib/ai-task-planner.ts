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
Always respond in the same language as the user.

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
If the user message contains Lithuanian words or Lithuanian grammar, respond in Lithuanian.
Otherwise respond in English.
Never respond in German.
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
export async function generateSelfImprovementSuggestions(context: {
  tasks: unknown[];
  activity: unknown[];
  memory: unknown;
  conversationMemory: unknown[];
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: `
You are the self-improvement planner for Master Agent OS.

Analyze the current project context and suggest the best next improvements.

Focus on:
- stability
- UX clarity
- execution reliability
- dashboard simplicity
- agent safety
- deploy visibility
- reducing repeated failures
- improving conversational workflow

Rules:
- Suggest 3 to 5 improvements.
- Keep each improvement small and actionable.
- Prefer safe UI/runtime improvements.
- Do not suggest broad rewrites.
- Do not suggest external services unless clearly useful.
- If Lithuanian context is present, respond in Lithuanian.
- Never respond in German.

Respond in plain text with:
1. Short status summary
2. Recommended improvements
3. Best next step
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
    "No self-improvement suggestions available."
  );
}

export async function generateImprovementTasks(
  suggestions: string
) {
  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You convert improvement suggestions into executable engineering tasks.

Rules:
- Generate 2 to 5 tasks.
- Keep tasks safe and specific.
- Prefer UI/dashboard/runtime improvements.
- Use only these target files:

- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
- app/agents/page.tsx
- app/execution/page.tsx

Respond ONLY valid JSON array.

Format:
[
  {
    "title": "...",
    "summary": "...",
    "targetFile": "...",
    "priority": "low|medium|high"
  }
]
          `,
        },
        {
          role: "user",
          content: suggestions,
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

export async function determineAgentRole(
  prompt: string
) {
  const normalized =
    prompt.toLowerCase();

  if (
    normalized.includes(
      "deploy"
    ) ||
    normalized.includes(
      "production"
    )
  ) {
    return "deploy";
  }

  if (
    normalized.includes(
      "review"
    ) ||
    normalized.includes(
      "analyze"
    ) ||
    normalized.includes(
      "failure"
    )
  ) {
    return "reviewer";
  }

  if (
    normalized.includes(
      "plan"
    ) ||
    normalized.includes(
      "roadmap"
    )
  ) {
    return "planner";
  }

  return "executor";
}

export async function generateAgentDelegationResponse(context: {
  prompt: string;
  agentRole: "planner" | "executor" | "reviewer" | "deploy";
  projectContext?: unknown;
}) {
  const roleInstructions = {
    planner:
      "You are the Planner Agent. Create a concise execution plan. Do not create code. Focus on sequencing and safe next steps.",
    executor:
      "You are the Execution Agent. Convert the request into a safe executable engineering task.",
    reviewer:
      "You are the Reviewer Agent. Analyze risks, failures, recent activity, and quality issues. Recommend what should be fixed.",
    deploy:
      "You are the Deploy Agent. Analyze deployment status, production readiness, and deploy risks.",
  };

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
${roleInstructions[context.agentRole]}

Rules:
- Be concise.
- Be practical.
- If Lithuanian is used, respond in Lithuanian.
- Never respond in German.
- Do not invent facts not present in context.
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
    "No agent response available."
  );
}
