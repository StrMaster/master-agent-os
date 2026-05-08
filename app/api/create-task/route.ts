import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

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
  source: "manual";
  summary?: string;
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readGithubJson(path: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${path}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    json: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeGithubJson(path: string, json: unknown, sha: string, message: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64"
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
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
    throw new Error(`Failed to write ${path}: ${res.status} ${text}`);
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

function isSafeTargetFile(targetFile: string) {
  return SAFE_TARGET_FILES.includes(targetFile);
}

async function logActivity(event: Record<string, unknown>) {
  const { json: activity, sha } = await readGithubJson(ACTIVITY_PATH);

  const updatedActivity = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...(Array.isArray(activity) ? activity : []),
  ].slice(0, 100);

  await writeGithubJson(
    ACTIVITY_PATH,
    updatedActivity,
    sha,
    "Log manual task creation"
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const prompt = String(body.prompt ?? "").trim();

let title = normalizeTitle(body.title);
let targetFile = String(body.targetFile ?? "").trim();
let priority = normalizePriority(body.priority);
let summary = title || prompt;

if (prompt) {
  title = title || prompt;

  const normalizedPrompt = prompt.toLowerCase();

  if (
  normalizedPrompt.includes("activity") ||
  normalizedPrompt.includes("feed") ||
  normalizedPrompt.includes("timeline") ||
  normalizedPrompt.includes("logs")
) {
  targetFile = "app/components/ActivityFeed.tsx";
}

if (
  normalizedPrompt.includes("dashboard") ||
  normalizedPrompt.includes("layout") ||
  normalizedPrompt.includes("home") ||
  normalizedPrompt.includes("page")
) {
  targetFile = "app/page.tsx";
}

if (
  normalizedPrompt.includes("run button") ||
  normalizedPrompt.includes("runner") ||
  normalizedPrompt.includes("execution")
) {
  targetFile = "app/components/RunAgentButton.tsx";
}

if (
  normalizedPrompt.includes("agent") ||
  normalizedPrompt.includes("agents")
) {
  targetFile = "app/agents/page.tsx";
}

if (
  normalizedPrompt.includes("mobile") ||
  normalizedPrompt.includes("responsive") ||
  normalizedPrompt.includes("spacing") ||
  normalizedPrompt.includes("overflow")
) {
  priority = "high";
}

if (
  normalizedPrompt.includes("fix") ||
  normalizedPrompt.includes("urgent") ||
  normalizedPrompt.includes("broken") ||
  normalizedPrompt.includes("error") ||
  normalizedPrompt.includes("crash")
) {
  priority = "high";
}

if (
  normalizedPrompt.includes("improve") ||
  normalizedPrompt.includes("cleanup") ||
  normalizedPrompt.includes("optimize") ||
  normalizedPrompt.includes("refactor") ||
  normalizedPrompt.includes("simplify")
) {
  priority = priority === "high"
    ? "high"
    : "medium";
}
if (
  normalizedPrompt.includes("ui") ||
  normalizedPrompt.includes("ux") ||
  normalizedPrompt.includes("design")
) {
  targetFile = "app/page.tsx";
}

if (
  normalizedPrompt.includes("activity timeline") ||
  normalizedPrompt.includes("activity card")
) {
  targetFile = "app/components/ActivityFeed.tsx";
}

if (
  normalizedPrompt.includes("agent execution") ||
  normalizedPrompt.includes("run flow")
) {
  targetFile = "app/components/RunAgentButton.tsx";
}
if (
  normalizedPrompt.includes("mobile") &&
  normalizedPrompt.includes("dashboard")
) {
  summary =
    "Improve dashboard mobile layout and spacing for smaller screens";
}

if (
  normalizedPrompt.includes("activity") &&
  normalizedPrompt.includes("layout")
) {
  summary =
    "Improve activity feed layout and visual hierarchy";
}

if (
  normalizedPrompt.includes("run") &&
  normalizedPrompt.includes("button")
) {
  summary =
    "Improve run agent button execution experience";
}
}

    if (!title) {
      return NextResponse.json(
        {
          ok: false,
          mode: "validation-error",
          error: "Missing task title",
        },
        { status: 400 }
      );
    }

    if (!targetFile) {
      return NextResponse.json(
        {
          ok: false,
          mode: "validation-error",
          error: "Missing targetFile",
        },
        { status: 400 }
      );
    }

    if (!isSafeTargetFile(targetFile)) {
      return NextResponse.json(
        {
          ok: false,
          mode: "blocked",
          error: `Target file is not allowed: ${targetFile}`,
          allowedFiles: SAFE_TARGET_FILES,
        },
        { status: 400 }
      );
    }

    const { json: tasksJson, sha } = await readGithubJson(TASKS_PATH);
    const tasks = Array.isArray(tasksJson) ? tasksJson : [];

    const duplicate = tasks.find(
      (task: any) =>
        String(task.title ?? "").trim().toLowerCase() ===
          title.toLowerCase() &&
        String(task.targetFile ?? "").trim() === targetFile
    );

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          mode: "duplicate-task",
          error: "Similar task already exists",
          existingTask: {
            id: duplicate.id,
            title: duplicate.title,
            targetFile: duplicate.targetFile,
            status: duplicate.status,
          },
        },
        { status: 409 }
      );
    }

    const generatedTasks: AgentTask[] = [];

    const baseTask: AgentTask = {
  id: `manual-task-${Date.now()}`,
  title,
  summary,
  targetFile,
  status: "todo",
  priority,
  source: "manual",
  createdAt: new Date().toISOString(),
};

generatedTasks.push(baseTask);

if (
  prompt &&
  prompt.toLowerCase().includes("dashboard") &&
  prompt.toLowerCase().includes("activity")
) {
  generatedTasks.push({
    id: `manual-task-${Date.now()}-activity`,
    title: "Improve activity feed layout",
    summary:
      "Improve activity feed layout and visual hierarchy",
    targetFile: "app/components/ActivityFeed.tsx",
    status: "todo",
    priority,
    source: "manual",
    createdAt: new Date().toISOString(),
  });
}

const updatedTasks = [...tasks, ...generatedTasks];

    await writeGithubJson(
      TASKS_PATH,
      updatedTasks,
      sha,
      `Create manual agent task: ${generatedTasks[0].id}`
    );

    await logActivity({
  type: "manual-task-created",
  taskId: generatedTasks[0].id,
  summary: generatedTasks[0].title,
  targetFile: generatedTasks[0].targetFile,
  priority: generatedTasks[0].priority,
});

let conversationalPrefix = "Understood.";

const recentDashboardTasks = tasks.filter((task: any) =>
  String(task.targetFile).includes("page.tsx")
);

const recentActivityTasks = tasks.filter((task: any) =>
  String(task.targetFile).includes("ActivityFeed")
);

if (
  targetFile.includes("page.tsx") &&
  recentDashboardTasks.length > 2
) {
  conversationalPrefix =
    "Continuing dashboard improvement work.";
}

if (
  targetFile.includes("ActivityFeed") &&
  recentActivityTasks.length > 2
) {
  conversationalPrefix =
    "Continuing activity feed improvements.";
}

    const primaryTask = generatedTasks[0];

const conversationalMessage = `${conversationalPrefix} I created ${generatedTasks.length} task(s). Primary task: ${primaryTask.priority} priority for ${primaryTask.targetFile}.`;
const followUp =
  "You can monitor execution progress in the Activity Feed.";
return NextResponse.json({
  ok: true,
  mode: "manual-task-created",
  message: conversationalMessage,
  followUp,
  tasks: generatedTasks,
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