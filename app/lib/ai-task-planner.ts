import { openai } from "./openai";
import type { RepoContext } from "@/agents/core/repo-context";

type ProjectContext = {
  recentTasks: unknown[];
  recentActivity: unknown[];
  conversationMemory: unknown[];
  repoContext?: RepoContext;
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
- repo context hints

Your job:
- understand the user's intent
- choose the safest target file
- generate one small task
- keep the task safe and specific

Allowed target files:
- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
- app/execution/page.tsx

Rules:
- Only choose one allowed targetFile.
- Prefer small UI/copy/layout improvements.
- Do not suggest backend/API/config/package changes.
- Do not create broad refactors.
- If request is vague, choose the safest likely UI file.
- Use recent context to avoid repeating the same work.
- Prefer active runtime areas and avoid legacy or deprecated zones.
- Always return a specific title, summary, targetFile, priority, and reasoning.
- If the target is unclear or too broad, keep the task previewOnly with requiresApproval.

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
              repoContext: context?.repoContext ?? null,
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
- Every task must include title, summary, targetFile, priority, executionMode, and riskLevel.
- If a task is broad or the targetFile is unclear, keep it previewOnly with requiresApproval.
- Use only these target files:

- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
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

export async function generateReviewerFixTasks(context: {
  prompt: string;
  reviewerResponse: string;
  projectContext: unknown;
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are the Reviewer Agent task generator.

Convert reviewer findings into safe executable fix tasks.

Rules:
- Generate 1 to 3 tasks.
- Keep tasks small and safe.
- Only use allowed target files:
  - app/page.tsx
  - app/components/ActivityFeed.tsx
  - app/components/RunAgentButton.tsx
  - app/execution/page.tsx
- Do not suggest backend/config/package changes.
- If Lithuanian is used, respond in Lithuanian.
- Never respond in German.

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
        content: JSON.stringify(context, null, 2),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned empty reviewer fix task response");
  }

  return JSON.parse(content);
}

export async function generateExecutionSequence(
  context: {
    prompt: string;

    projectContext: unknown;
  }
) {
  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",

      temperature: 0.2,

      messages: [
        {
          role: "system",

          content: `
You are the Planner Agent.

Your job:
- create a safe execution sequence
- define execution order
- define dependencies
- minimize execution chaos

Rules:
- Generate 2 to 5 steps.
- Prefer small safe improvements.
- Avoid backend refactors.
- Preserve dependency order with dependsOn.
- Use parentTaskId and wave when returning planner-generated subtasks.
- Prefer dependsOnTaskIds and blockedBy for explicit dependency ordering.
- Use waveStatus to mark each step as ready, blocked, or completed.
- Mark planner-generated multi-step work as previewOnly with requiresApproval.
- Keep every step small, targeted, and approval-gated when the target is unclear.
- Use only these target files:

- app/page.tsx
- app/components/ActivityFeed.tsx
- app/components/RunAgentButton.tsx
- app/execution/page.tsx

Allowed agent roles:
- planner
- executor
- reviewer
- deploy

Respond ONLY valid JSON array.

Format:
[
  {
    "id": "step-1",

    "title": "...",

    "summary": "...",

    "agentRole": "executor",

    "targetFile": "...",

    "executionMode": "single-file|multi-step",

    "wave": 1,

    "waveStatus": "ready|blocked|completed",
    "previewOnly": true,
    "requiresApproval": true,

    "parentTaskId": "optional-parent-task-id",

    "priority": "low|medium|high",

    "dependsOnTaskIds": [],
    "blockedBy": []
  }
]
          `,
        },

        {
          role: "user",

          content: JSON.stringify(
            context,
            null,
            2
          ),
        },
      ],
    });

  const content =
    response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Execution sequence generation failed"
    );
  }

  return JSON.parse(content);
}

export async function generateRecoveryPlan(context: {
  failedTask: unknown;
  recentActivity: unknown[];
  memory: unknown;
}) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const failedTask = context.failedTask as Record<string, unknown>;
  const originalTargetFile = typeof failedTask?.targetFile === "string"
    ? failedTask.targetFile
    : null;
  const failureReason = typeof failedTask?.error === "string"
    ? failedTask.error
    : "Unknown failure";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are the Recovery Planner for Master Agent OS.

Your job:
- analyze a failed task and its error reason
- create one safe, specific recovery task
- use the SAME targetFile as the failed task unless the error clearly points elsewhere
- keep the fix small and surgical

Rules:
- Generate exactly one recovery task
- targetFile must be the same as the failed task's targetFile when possible
- title and summary must reference the specific failure reason
- Respond ONLY valid JSON, no markdown

Format:
{"title": "...", "summary": "...", "targetFile": "...", "priority": "low|medium|high", "reasoning": "..."}`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          failedTask: context.failedTask,
          originalTargetFile,
          failureReason,
          recentActivity: context.recentActivity.slice(0, 10),
        }),
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
export async function generateDeployRecoveryPlan(context: {
  deployError: unknown;
  recentActivity: unknown[];
  tasks: unknown[];
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are the Deploy Recovery Agent for Master Agent OS.

Your job:
- analyze deployment failures
- identify likely UI/runtime issue
- generate ONE safe recovery task

Rules:
- frontend only
- no package.json
- no config edits
- no backend infra edits
- only:
  - app/page.tsx
  - app/components/*
  - app/execution/page.tsx
- response must be valid JSON
- never respond in German

Format:
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
        content: JSON.stringify(context, null, 2),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Deploy recovery returned empty response");
  }

  return JSON.parse(content);
}
