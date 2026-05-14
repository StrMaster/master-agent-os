import { callModel } from "./model-router";
import type { RepoContext } from "@/agents/core/repo-context";

type ProjectContext = {
  recentTasks: unknown[];
  recentActivity: unknown[];
  conversationMemory: unknown[];
  repoContext?: RepoContext;
};

export async function generateTaskPlan(prompt: string, context?: ProjectContext) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are the planning brain for Master Agent OS.

Your job:
- understand the user's intent
- choose the most accurate targetFile from the allowed list
- generate one small, specific task
- keep scope minimal and safe

Allowed target files:
app/page.tsx, app/layout.tsx, app/execution/page.tsx, app/agents/page.tsx,
app/tasks/page.tsx, app/chat/page.tsx,
app/components/ActivityFeed.tsx, app/components/RunAgentButton.tsx,
app/components/MasterAgentChat.tsx, app/components/RuntimeDashboard.tsx,
app/components/RuntimeOverview.tsx, app/components/RecoveryControlCard.tsx,
app/components/ObservabilityCard.tsx, app/components/ControlCenterControls.tsx,
app/components/PendingPRQueue.tsx, app/components/DeployStatusCard.tsx,
app/components/ApprovalExecutionCenter.tsx,
app/api/agent-runner/route.ts, app/api/agent-runner/tasks.ts,
app/api/agent-runner/memory.ts, app/api/create-task/route.ts,
app/api/master-agent/route.ts, app/api/observability/route.ts,
agents/core/agent-router.ts, agents/core/agent-registry.ts,
app/lib/code-patch-generator.ts, app/tasks/task-utils.ts, app/tasks/task-data.ts

Rules:
- Pick the most specific matching file, not always app/page.tsx
- Prefer small targeted changes
- If backend/API task: use backend file, set riskLevel "medium"
- If UI task: use component file, set riskLevel "low"
- If unclear or broad: set previewOnly true, requiresApproval true
- Use recent context to avoid repeating same work
- Always respond in the same language as the user

Respond ONLY valid JSON, no markdown:
{"title":"...","summary":"...","targetFile":"...","priority":"low|medium|high","riskLevel":"low|medium|high","intent":"ui-polish|bugfix|refactor|backend|memory","previewOnly":false,"requiresApproval":false,"reasoning":"..."}`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          prompt,
          recentTasks: context?.recentTasks?.slice(0, 5) ?? [],
          recentActivity: context?.recentActivity?.slice(0, 5) ?? [],
          repoContext: context?.repoContext ?? null,
        }),
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function generateProjectStatusSummary(context: {
  tasks: unknown[];
  activity: unknown[];
  memory: unknown;
  conversationMemory: unknown[];
}) {
  const raw = await callModel(
    "analyst",
    `You are the Project Status Analyst for Master Agent OS.
Analyze the current state and return a short status summary.
Respond ONLY valid JSON: {"summary":"...","health":"healthy|degraded|blocked","nextAction":"..."}`,
    JSON.stringify(context),
    256
  );
  return JSON.parse(raw);
}
export async function generateSelfImprovementSuggestions(context: {
  tasks: unknown[];
  activity: unknown[];
  memory: unknown;
  conversationMemory: unknown[];
}) {
  const raw = await callModel(
    "analyst",
    `You are the Self-Improvement Analyst for Master Agent OS.
Analyze tasks, activity, and memory. Suggest 3 small improvements.
Respond ONLY valid JSON: {"suggestions":[{"title":"...","description":"...","priority":"low|medium|high"}]}`,
    JSON.stringify(context),
    512
  );
  return JSON.parse(raw);
}

export async function generateImprovementTasks(
  suggestions: string
) {
  const raw = await callModel(
    "planner",
    `You are the Improvement Task Generator for Master Agent OS.
Generate small executable improvement tasks based on suggestions.
Respond ONLY valid JSON array: [{"title":"...","summary":"...","targetFile":"...","priority":"low|medium|high"}]`,
    JSON.stringify({ suggestions }),
    512
  );
  return JSON.parse(raw);
}

export async function determineAgentRole(
  prompt: string
) {
  const raw = await callModel(
    "planner",
    `You are the Agent Role Selector for Master Agent OS.
Given a task, pick the best agent role.
Respond ONLY valid JSON: {"role":"...","reason":"..."}`,
    JSON.stringify({ prompt }),
    128
  );
  return JSON.parse(raw);
}

export async function generateAgentDelegationResponse(context: {
  prompt: string;
  agentRole: "planner" | "executor" | "reviewer" | "deploy";
  projectContext?: unknown;
}) {
  const raw = await callModel(
    "analyst",
    `You are the Agent Delegation Responder for Master Agent OS.
Generate a short response explaining what the agent will do.
Respond ONLY valid JSON: {"response":"...","nextSteps":["..."]}`,
    JSON.stringify(context),
    256
  );
  return JSON.parse(raw);
}

export async function generateReviewerFixTasks(context: {
  prompt: string;
  reviewerResponse: string;
  projectContext: unknown;
}) {
  const raw = await callModel(
    "reviewer",
    `You are the Reviewer Fix Task Generator for Master Agent OS.
Given a failed review, generate fix tasks.
Respond ONLY valid JSON array: [{"title":"...","summary":"...","targetFile":"...","priority":"low|medium|high"}]`,
    JSON.stringify(context),
    512
  );
  return JSON.parse(raw);
}

export async function generateExecutionSequence(
  context: {
    prompt: string;

    projectContext: unknown;
  }
) {
  const raw = await callModel(
    "planner",
    `You are the Execution Sequence Planner for Master Agent OS.
Generate an ordered execution sequence for the given tasks.
Respond ONLY valid JSON: {"sequence":[{"taskId":"...","order":1,"reason":"..."}]}`,
    JSON.stringify(context),
    512
  );
  return JSON.parse(raw);
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
  const raw = await callModel(
    "recovery",
    `You are the Deploy Recovery Agent for Master Agent OS.
Analyze deployment failures and generate ONE safe recovery task.
Rules: frontend only, no package.json, no config edits.
Respond ONLY valid JSON: {"title":"...","summary":"...","targetFile":"...","priority":"low|medium|high","reasoning":"..."}`,
    JSON.stringify(context),
    512
  );
  return JSON.parse(raw);
}
