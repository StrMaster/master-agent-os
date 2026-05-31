import { NextResponse } from "next/server";
import { enqueueRuntimeTask } from "@/app/lib/runtime-queue";

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/execution/page.tsx",
  "app/agents/page.tsx",
  "app/tasks/page.tsx",
  "app/chat/page.tsx",
  "app/components/ActivityFeed.tsx",
  "app/components/RunAgentButton.tsx",
  "app/components/MasterAgentChat.tsx",
  "app/components/RuntimeDashboard.tsx",
  "app/components/RuntimeOverview.tsx",
  "app/components/RecoveryControlCard.tsx",
  "app/components/ObservabilityCard.tsx",
  "app/components/ControlCenterControls.tsx",
  "app/components/PendingPRQueue.tsx",
  "app/components/DeployStatusCard.tsx",
  "app/components/ApprovalExecutionCenter.tsx",
  "app/api/agent-runner/route.ts",
  "app/api/agent-runner/tasks.ts",
  "app/api/agent-runner/memory.ts",
  "app/api/create-task/route.ts",
  "app/api/master-agent/route.ts",
  "app/api/observability/route.ts",
  "agents/core/agent-router.ts",
  "agents/core/agent-registry.ts",
  "app/lib/code-patch-generator.ts",
  "app/tasks/task-utils.ts",
  "app/tasks/task-data.ts",
];

type Priority = "low" | "medium" | "high";

type AgentTask = {
  id: string;
  title: string;
  targetFile: string;
  status: "todo" | "queued";
  priority: Priority;
  createdAt: string;
  queuedAt?: string;
  updatedAt?: string;
  source: "manual";
  summary?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  plannerNotes?: string;
  agentRole?: string;
  agentName?: string;
  agentSystemPrompt?: string;
  routingReason?: string;
};

function normalizeTitle(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePriority(value: unknown): Priority {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "low";
}

function inferTargetFile(prompt: string) {
  const t = prompt.toLowerCase();

  if (t.includes("layout") || t.includes("navigaci") || t.includes("nav ")) return "app/layout.tsx";
  if (t.includes("tasks page") || t.includes("taskų puslap") || t.includes("task list")) return "app/tasks/page.tsx";
  if (t.includes("chat") || t.includes("master chat") || t.includes("master agent chat")) return "app/components/MasterAgentChat.tsx";
  if (t.includes("observability") || t.includes("stebėjim")) return "app/components/ObservabilityCard.tsx";
  if (t.includes("recovery") || t.includes("atkūrim")) return "app/components/RecoveryControlCard.tsx";
  if (t.includes("runtime dashboard") || t.includes("runtime overview")) return "app/components/RuntimeDashboard.tsx";
  if (t.includes("control") || t.includes("valdymo")) return "app/components/ControlCenterControls.tsx";
  if (t.includes("pending pr") || t.includes("pr queue")) return "app/components/PendingPRQueue.tsx";
  if (t.includes("deploy status")) return "app/components/DeployStatusCard.tsx";
  if (t.includes("approval") || t.includes("patvirtinimo")) return "app/components/ApprovalExecutionCenter.tsx";
  if (t.includes("activity") || t.includes("feed") || t.includes("timeline") || t.includes("logs")) return "app/components/ActivityFeed.tsx";
  if (t.includes("execution page") || t.includes("runner")) return "app/execution/page.tsx";
  if (t.includes("agents page") || t.includes("agent cards")) return "app/agents/page.tsx";
  if (t.includes("agent router") || t.includes("routing")) return "agents/core/agent-router.ts";
  if (t.includes("patch generator") || t.includes("patch gen")) return "app/lib/code-patch-generator.ts";
  if (t.includes("agent runner") || t.includes("runner route")) return "app/api/agent-runner/route.ts";
  if (t.includes("memory") || t.includes("atmintis")) return "app/api/agent-runner/memory.ts";
  if (t.includes("run button") || t.includes("run agent")) return "app/components/RunAgentButton.tsx";

  return "app/page.tsx";
}


function inferTitle(prompt: string) {
  const cleanPrompt = prompt
    .replace(/^create task:/i, "")
    .replace(/^create task/i, "")
    .trim();

  const firstSentence = cleanPrompt.split(/\n|\. Goals:|\. Constraints:/i)[0]?.trim();

  return firstSentence || cleanPrompt || "Manual task";
}

function inferPriority(prompt: string, explicitPriority: unknown): Priority {
  const normalized = prompt.toLowerCase();
  const explicit = normalizePriority(explicitPriority);

  if (explicit !== "low") {
    return explicit;
  }

  if (
    normalized.includes("urgent") ||
    normalized.includes("broken") ||
    normalized.includes("error") ||
    normalized.includes("high priority")
  ) {
    return "high";
  }

  if (
    normalized.includes("improve") ||
    normalized.includes("spacing") ||
    normalized.includes("ui") ||
    normalized.includes("ux") ||
    normalized.includes("readability")
  ) {
    return "medium";
  }

  return "low";
}

function shouldQueueOnly(prompt: string, body: Record<string, unknown>) {
  const normalized = prompt.toLowerCase();

  return (
    body.previewOnly === true ||
    body.requiresApproval === true ||
    normalized.includes("no auto-run") ||
    normalized.includes("no auto run") ||
    normalized.includes("do not auto-run") ||
    normalized.includes("do not auto run") ||
    normalized.includes("planner only") ||
    normalized.includes("preview only") ||
    normalized.includes("wait for approval") ||
    normalized.includes("approval before execution") ||
    normalized.includes("manual approval")
  );
}

function buildTask(body: Record<string, unknown>): AgentTask {
  const prompt = String(body.prompt ?? "").trim();
  const title = normalizeTitle(body.title) || inferTitle(prompt);
  const targetFile = String(body.targetFile ?? "").trim() || inferTargetFile(prompt);
  const queueOnly = shouldQueueOnly(prompt, body);
  const priority = inferPriority(prompt, body.priority);
  const createdAt = new Date().toISOString();

  return {
    id: `manual-task-${Date.now()}`,
    title,
    summary:
      String(body.summary ?? "").trim() ||
      `Plan safe work for: ${title}`,
    targetFile: SAFE_TARGET_FILES.includes(targetFile) ? targetFile : "app/page.tsx",
    status: queueOnly ? "todo" : "queued",
    priority,
    source: "manual",
    createdAt,
    queuedAt: createdAt,
    updatedAt: createdAt,
    agentRole: typeof body.agentRole === "string" ? body.agentRole : "senior-execution",
    agentName: typeof body.agentName === "string" ? body.agentName : "Senior Execution Agent",
    agentSystemPrompt:
      typeof body.agentSystemPrompt === "string"
        ? body.agentSystemPrompt
        : undefined,
    routingReason:
      typeof body.routingReason === "string" ? body.routingReason : undefined,
    intent: (() => {
  const t = prompt.toLowerCase();
  if (t.includes("fix") || t.includes("bug") || t.includes("error") || t.includes("broken")) return "bugfix";
  if (t.includes("refactor") || t.includes("clean") || t.includes("išvalyk") || t.includes("pertvarky")) return "refactor";
  if (t.includes("api") || t.includes("route") || t.includes("backend") || t.includes("endpoint")) return "backend";
  if (t.includes("memory") || t.includes("atmintis") || t.includes("supabase")) return "memory";
  return "ui-polish";
})(),
    riskLevel: queueOnly ? "medium" : "low",
    executionMode: "single-file",
    wave: 1,
    previewOnly: queueOnly,
    requiresApproval: queueOnly,
    plannerNotes: queueOnly
      ? "Preview/planner task. Wait for approval before execution."
      : "Manual task queued in Redis. Code execution should happen through protected PR flow.",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const prompt = String(body.prompt ?? "").trim();
    const task = buildTask(body);
    const queueOnly = shouldQueueOnly(prompt, body);

    await enqueueRuntimeTask(task);

    const taskWord = "task";
    const message = queueOnly
      ? `Created 1 preview ${taskWord}. Auto-run was not started.`
      : `Created 1 queued ${taskWord}. Runner can execute through PR-only flow.`;

    const followUp = queueOnly
      ? "This task was stored in Redis and can be approved before execution."
      : "Task was stored in Redis runtime queue without a GitHub metadata commit, so it should not trigger a Vercel build.";

    return NextResponse.json({
      ok: true,
      mode: queueOnly ? "preview-task-created" : "manual-task-created",
      message,
      followUp,
      task,
      tasks: [task],
    });
  } catch (error) {
console.error("[create-task] error", error);
    return NextResponse.json(
      {
        ok: false,
        mode: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
