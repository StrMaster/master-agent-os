import { NextResponse } from "next/server";
import { generateTaskPlan } from "@/app/lib/ai-task-planner";
import {
  addRuntimeTask,
} from "@/app/lib/task-runtime";


const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";
const CONVERSATION_MEMORY_PATH =
  ".agent/conversation-memory.json";

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/execution/page.tsx",
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
  startedAt?: string;
  completedAt?: string;
  source: "manual";
  summary?: string;
intent?: string;
riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  parentTaskId?: string;
  plannerNotes?: string;
  dependsOn?: string[];
  dependsOnTaskIds?: string[];
  blockedBy?: string[];
  agentRole?: string;
agentName?: string;
agentSystemPrompt?: string;
routingReason?: string;
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

async function readOptionalGithubJson(path: string, fallback: unknown) {
  try {
    const { json } = await readGithubJson(path);
    return json;
  } catch {
    return fallback;
  }
}

async function getProjectContext() {
  const [tasks, activity, conversationMemory] = await Promise.all([
    readOptionalGithubJson(TASKS_PATH, []),
    readOptionalGithubJson(ACTIVITY_PATH, []),
    readOptionalGithubJson(".agent/conversation-memory.json", []),
  ]);

  return {
    recentTasks: Array.isArray(tasks) ? tasks.slice(-10) : [],
    recentActivity: Array.isArray(activity) ? activity.slice(0, 15) : [],
    conversationMemory: Array.isArray(conversationMemory)
      ? conversationMemory.slice(0, 10)
      : [],
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

function normalizeDependencyIds(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dependencyIds = value.filter(
    (dependencyId: unknown): dependencyId is string =>
      typeof dependencyId === "string" && dependencyId.trim().length > 0,
  );

  const uniqueDependencyIds = [...new Set(dependencyIds)];

  return uniqueDependencyIds.length > 0 ? uniqueDependencyIds : undefined;
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

async function updateConversationMemory(entry: {
  prompt?: string;
  summary?: string;
  targetFile?: string;
}) {
  const { json, sha } = await readGithubJson(
    CONVERSATION_MEMORY_PATH
  );

  const memory = Array.isArray(json) ? json : [];

  const updatedMemory = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...memory,
  ].slice(0, 25);

  await writeGithubJson(
    CONVERSATION_MEMORY_PATH,
    updatedMemory,
    sha,
    "Update conversation memory"
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
const agentMetadata = {
  agentRole:
    typeof body.agentRole === "string" ? body.agentRole : undefined,
  agentName:
    typeof body.agentName === "string" ? body.agentName : undefined,
  agentSystemPrompt:
    typeof body.agentSystemPrompt === "string"
      ? body.agentSystemPrompt
      : undefined,
  routingReason:
    typeof body.routingReason === "string" ? body.routingReason : undefined,
};
const plannerMetadata = {
  executionMode:
    body.executionMode === "multi-step" || body.executionMode === "single-file"
      ? body.executionMode
      : undefined,
  wave:
    typeof body.wave === "number" && Number.isFinite(body.wave)
      ? body.wave
      : undefined,
  previewOnly: body.previewOnly === true,
  requiresApproval: body.requiresApproval === true,
  parentTaskId:
    typeof body.parentTaskId === "string" ? body.parentTaskId : undefined,
  plannerNotes:
    typeof body.plannerNotes === "string" ? body.plannerNotes : undefined,
  dependsOn:
    normalizeDependencyIds(body.dependsOn) ??
    normalizeDependencyIds(body.dependsOnTaskIds),
  dependsOnTaskIds: normalizeDependencyIds(body.dependsOnTaskIds),
  blockedBy: normalizeDependencyIds(body.blockedBy),
};

    const prompt = String(body.prompt ?? "").trim();

let title = normalizeTitle(body.title);
let targetFile = String(body.targetFile ?? "").trim();
let priority = normalizePriority(body.priority);
let summary = title || prompt;
let reasoningHint = "";
let intent = "code-improvement";
let riskLevel: "low" | "medium" | "high" = "low";
let executionMode: "single-file" | "multi-step" = "single-file";
let wave = 1;
let previewOnly = false;
let requiresApproval = false;
let parentTaskId = plannerMetadata.parentTaskId;
let plannerNotes = "Single safe execution task.";
let dependsOn = plannerMetadata.dependsOn;
let dependsOnTaskIds = plannerMetadata.dependsOnTaskIds ?? plannerMetadata.dependsOn;
let blockedBy =
  plannerMetadata.blockedBy ??
  plannerMetadata.dependsOnTaskIds ??
  plannerMetadata.dependsOn;


if (prompt && process.env.OPENAI_API_KEY) {
  try {
    const projectContext = await getProjectContext();
const aiPlan = await generateTaskPlan(prompt, projectContext);

    title = normalizeTitle(aiPlan.title) || title || prompt;
    summary = aiPlan.summary || summary || title;
    targetFile = aiPlan.targetFile || targetFile;
    priority = normalizePriority(aiPlan.priority);
    reasoningHint = aiPlan.reasoning || reasoningHint;
  } catch (error) {
    console.warn("AI task planner failed, using rule-based fallback:", error);
  }
}

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
  reasoningHint =
  "Detected activity/feed related keywords.";
}

if (
  normalizedPrompt.includes("dashboard") ||
  normalizedPrompt.includes("layout") ||
  normalizedPrompt.includes("home") ||
  normalizedPrompt.includes("page")
) {
  targetFile = "app/page.tsx";
  reasoningHint =
  "Detected dashboard/layout related keywords.";
}

if (
  normalizedPrompt.includes("run button") ||
  normalizedPrompt.includes("runner") ||
  normalizedPrompt.includes("execution")
) {
  targetFile = "app/components/RunAgentButton.tsx";
  reasoningHint =
  "Detected execution/runner related keywords.";
}

if (
  normalizedPrompt.includes("agent") ||
  normalizedPrompt.includes("agents")
) {
  targetFile = "app/execution/page.tsx";
  reasoningHint =
  "Detected agent execution related keywords.";
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

    if (prompt) {
  const normalizedPrompt = prompt.toLowerCase();

  if (
    normalizedPrompt.includes("refactor") ||
    normalizedPrompt.includes("runtime") ||
    normalizedPrompt.includes("agent-runner") ||
    normalizedPrompt.includes("api") ||
    normalizedPrompt.includes("recovery") ||
    normalizedPrompt.includes("deploy")
  ) {
    riskLevel = "medium";
    plannerNotes = "Medium-risk system task. Keep scope narrow and validate build.";
  }

  if (
    normalizedPrompt.includes("auto-merge") ||
    normalizedPrompt.includes("overnight") ||
    normalizedPrompt.includes("database") ||
    normalizedPrompt.includes("auth") ||
    normalizedPrompt.includes("multi-file")
  ) {
    riskLevel = "high";
    executionMode = "multi-step";
    wave = 1;
    previewOnly = true;
    requiresApproval = true;
    plannerNotes =
      "High-risk multi-step task. Planner should split this into safe execution waves.";
  }

  if (
    normalizedPrompt.includes("button") ||
    normalizedPrompt.includes("copy") ||
    normalizedPrompt.includes("microcopy") ||
    normalizedPrompt.includes("spacing")
  ) {
    intent = "ui-polish";
  }

  if (
    normalizedPrompt.includes("fix") ||
    normalizedPrompt.includes("bug") ||
    normalizedPrompt.includes("error")
  ) {
    intent = "bugfix";
  }

  if (
    normalizedPrompt.includes("recovery") ||
    normalizedPrompt.includes("failed") ||
    normalizedPrompt.includes("failure")
  ) {
    intent = "recovery";
  }

  if (executionMode === "multi-step") {
    previewOnly = true;
    requiresApproval = true;
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
  queuedAt: new Date().toISOString(),
  ...agentMetadata,
  executionMode: plannerMetadata.executionMode ?? executionMode,
  wave: plannerMetadata.wave ?? wave,
  previewOnly: plannerMetadata.previewOnly ?? previewOnly,
  requiresApproval:
    plannerMetadata.requiresApproval ??
    (requiresApproval ||
      (plannerMetadata.executionMode ?? executionMode) === "multi-step"),
  parentTaskId,
  plannerNotes: plannerMetadata.plannerNotes ?? plannerNotes,
  dependsOn,
  dependsOnTaskIds,
  blockedBy,
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
    queuedAt: new Date().toISOString(),
    ...agentMetadata,
    intent: "ui-polish",
    riskLevel: "low",
    executionMode: "single-file",
    wave: 1,
    previewOnly: false,
    requiresApproval: false,
    plannerNotes: "Safe UI polish task generated from dashboard/activity prompt.",
    dependsOn,
    dependsOnTaskIds,
    blockedBy,
    parentTaskId,
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
  reasoning: reasoningHint,
});

await updateConversationMemory({
  prompt,
  summary,
  targetFile,
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

const taskWord = generatedTasks.length === 1 ? "task" : "tasks";

const conversationalMessage =
  `${conversationalPrefix} I created ${generatedTasks.length} ${taskWord}. ` +
  `Primary task: ${primaryTask.priority} priority for ${primaryTask.targetFile}.`;
const followUp = reasoningHint
  ? `${reasoningHint} You can monitor execution progress in the Activity Feed.`
  : "You can monitor execution progress in the Activity Feed.";

for (const task of generatedTasks) {
  addRuntimeTask({
    id: task.id,
    title: task.title,
    status: "queued",
  });
}

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
