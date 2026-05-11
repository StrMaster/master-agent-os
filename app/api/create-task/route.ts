import { NextResponse } from "next/server";
import { addRuntimeTask } from "@/app/lib/task-runtime";

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/execution/page.tsx",
  "app/agents/page.tsx",
  "app/components/RunAgentButton.tsx",
  "app/components/ActivityFeed.tsx",
];

type Priority = "low" | "medium" | "high";

type AgentTask = {
  id: string;
  title: string;
  targetFile: string;
  status: "todo";
  priority: Priority;
  createdAt: string;
  queuedAt?: string;
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
  const normalized = prompt.toLowerCase();

  if (normalized.includes("agents page") || normalized.includes("agent cards")) {
    return "app/agents/page.tsx";
  }

  if (
    normalized.includes("activity") ||
    normalized.includes("feed") ||
    normalized.includes("timeline") ||
    normalized.includes("logs")
  ) {
    return "app/components/ActivityFeed.tsx";
  }

  if (
    normalized.includes("run button") ||
    normalized.includes("runner") ||
    normalized.includes("execution")
  ) {
    return "app/execution/page.tsx";
  }

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

  return {
    id: `manual-task-${Date.now()}`,
    title,
    summary:
      String(body.summary ?? "").trim() ||
      `Plan safe work for: ${title}`,
    targetFile: SAFE_TARGET_FILES.includes(targetFile) ? targetFile : "app/page.tsx",
    status: "todo",
    priority,
    source: "manual",
    createdAt: new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    agentRole: typeof body.agentRole === "string" ? body.agentRole : undefined,
    agentName: typeof body.agentName === "string" ? body.agentName : undefined,
    agentSystemPrompt:
      typeof body.agentSystemPrompt === "string"
        ? body.agentSystemPrompt
        : undefined,
    routingReason:
      typeof body.routingReason === "string" ? body.routingReason : undefined,
    intent: prompt.toLowerCase().includes("fix") ? "bugfix" : "ui-polish",
    riskLevel: queueOnly ? "medium" : "low",
    executionMode: queueOnly ? "single-file" : "single-file",
    wave: 1,
    previewOnly: queueOnly,
    requiresApproval: queueOnly,
    plannerNotes: queueOnly
      ? "Preview/planner task only. Runtime state is not committed to GitHub. Wait for approval before execution."
      : "Runtime task created. Code execution should still happen through protected PR flow.",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const prompt = String(body.prompt ?? "").trim();
    const task = buildTask(body);
    const queueOnly = shouldQueueOnly(prompt, body);

    addRuntimeTask({
      id: task.id,
      title: task.title,
      status: "queued",
    });

    const taskWord = "task";
    const message = queueOnly
      ? `Created 1 preview ${taskWord}. Auto-run was not started.`
      : `Created 1 runtime ${taskWord}. Use protected runner controls to execute.`;

    const followUp = queueOnly
      ? "This task is stored in runtime memory only, so it will not create a GitHub commit or trigger a Vercel build."
      : "Runtime task was queued without metadata commits. Code changes should still be made through PR-only flow.";

    return NextResponse.json({
      ok: true,
      mode: queueOnly ? "preview-task-created" : "manual-task-created",
      message,
      followUp,
      task,
      tasks: [task],
    });
  } catch (error) {
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
