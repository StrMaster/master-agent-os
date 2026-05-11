import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

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

type GitHubFile = {
  sha: string;
  content: string;
};

async function readTasksJson() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${TASKS_PATH}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  const parsed = JSON.parse(content);

  return {
    tasks: Array.isArray(parsed) ? (parsed as AgentTask[]) : [],
    sha: file.sha,
  };
}

async function writeTasksJson(tasks: AgentTask[], sha: string, message: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(tasks, null, 2) + "\n").toString(
    "base64"
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content,
        sha,
        branch: BRANCH,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${TASKS_PATH}: ${res.status} ${text}`);
  }
}

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
    executionMode: "single-file",
    wave: 1,
    previewOnly: queueOnly,
    requiresApproval: queueOnly,
    plannerNotes: queueOnly
      ? "Preview/planner task. Wait for approval before execution."
      : "Manual task queued. Code execution should happen through protected PR flow.",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const prompt = String(body.prompt ?? "").trim();
    const task = buildTask(body);
    const queueOnly = shouldQueueOnly(prompt, body);

    const { tasks, sha } = await readTasksJson();
    const nextTasks = [task, ...tasks.filter((candidate) => candidate.id !== task.id)];

    await writeTasksJson(nextTasks, sha, `Create manual task ${task.id}`);

    const taskWord = "task";
    const message = queueOnly
      ? `Created 1 preview ${taskWord}. Auto-run was not started.`
      : `Created 1 queued ${taskWord}. Runner can execute through PR-only flow.`;

    const followUp = queueOnly
      ? "This task was persisted to the planner queue and can be approved before execution."
      : "Task was persisted to the GitHub-backed queue. This may trigger a Vercel build, but runner state will be stable.";

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
