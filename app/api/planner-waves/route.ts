import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

type AgentTask = {
  id: string;
  title: string;
  summary?: string;
  targetFile?: string;
  status?: string;
  priority?: "low" | "medium" | "high";
  source?: string;
  createdAt?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  plannerNotes?: string;
  parentTaskId?: string;
  dependsOnTaskIds?: string[];
  blockedBy?: string[];
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readGithubJson(path: string, fallback: unknown) {
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
    },
  );

  if (!res.ok) {
    return { json: fallback, sha: null };
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    json: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeGithubJson(
  path: string,
  json: unknown,
  sha: string,
  message: string,
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64",
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
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${path}: ${res.status} ${text}`);
  }
}

async function logActivity(event: Record<string, unknown>) {
  const { json, sha } = await readGithubJson(ACTIVITY_PATH, []);

  if (!sha) return;

  const activity = Array.isArray(json) ? json : [];

  const updatedActivity = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...activity,
  ].slice(0, 150);

  await writeGithubJson(
    ACTIVITY_PATH,
    updatedActivity,
    sha,
    "Log planner waves activity",
  );
}

function createWaveTasks(task: AgentTask): AgentTask[] {
  const now = new Date().toISOString();
  const baseTitle = task.title || "Untitled planner task";
  const targetFile = task.targetFile || "app/page.tsx";
  const wave1Id = `wave-${task.id}-1-${Date.now()}`;
  const wave2Id = `wave-${task.id}-2-${Date.now()}`;
  const wave3Id = `wave-${task.id}-3-${Date.now()}`;

  return [
    {
      id: wave1Id,
      title: `Wave 1: Scope and prepare — ${baseTitle}`,
      summary:
        task.summary ??
        `Prepare a safe first step for: ${baseTitle}. Keep changes minimal and build-safe.`,
      targetFile,
      status: "todo",
      priority: "high",
      source: "planner-wave",
      createdAt: now,
      intent: task.intent ?? "planning",
      riskLevel: "medium",
      executionMode: "single-file",
      wave: 1,
      parentTaskId: task.id,
      dependsOnTaskIds: [],
      blockedBy: [],
      plannerNotes:
        "Wave 1: inspect current architecture, keep scope minimal, avoid rewrites.",
    },
    {
      id: wave2Id,
      title: `Wave 2: Implement core change — ${baseTitle}`,
      summary:
        task.summary ??
        `Implement the main safe change for: ${baseTitle}. Use current architecture.`,
      targetFile,
      status: "todo",
      priority: "high",
      source: "planner-wave",
      createdAt: now,
      intent: task.intent ?? "implementation",
      riskLevel: "medium",
      executionMode: "single-file",
      wave: 2,
      parentTaskId: task.id,
      dependsOnTaskIds: [wave1Id],
      blockedBy: [wave1Id],
      plannerNotes:
        "Wave 2: implement the core change only after Wave 1 is safe.",
    },
    {
      id: wave3Id,
      title: `Wave 3: Polish and verify — ${baseTitle}`,
      summary:
        task.summary ??
        `Polish, verify, and make the result clearer for: ${baseTitle}.`,
      targetFile,
      status: "todo",
      priority: "medium",
      source: "planner-wave",
      createdAt: now,
      intent: task.intent ?? "verification",
      riskLevel: "low",
      executionMode: "single-file",
      wave: 3,
      parentTaskId: task.id,
      dependsOnTaskIds: [wave2Id],
      blockedBy: [wave2Id],
      plannerNotes:
        "Wave 3: polish, verify UI/runtime state, and keep changes low-risk.",
    },
  ];
}

function validateDependencyOrder(tasks: AgentTask[]) {
  return tasks.every((task, index) => {
    const dependencyIds = task.dependsOnTaskIds ?? task.blockedBy ?? [];

    return dependencyIds.every((dependencyId) => {
      const dependencyIndex = tasks.findIndex(
        (candidate) => candidate.id === dependencyId,
      );

      return dependencyIndex >= 0 && dependencyIndex < index;
    });
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const taskId = String(body.taskId ?? "");

    if (!taskId) {
      return NextResponse.json(
        {
          ok: false,
          mode: "missing-task-id",
          error: "taskId is required",
        },
        { status: 400 },
      );
    }

    const { json, sha } = await readGithubJson(TASKS_PATH, []);

    if (!sha) {
      throw new Error(`Missing ${TASKS_PATH}`);
    }

    const tasks = Array.isArray(json) ? (json as AgentTask[]) : [];
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    const task = tasks[taskIndex];

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          mode: "task-not-found",
          error: "Task not found",
        },
        { status: 404 },
      );
    }

    const existingWaves = tasks.filter(
      (candidate) => candidate.parentTaskId === task.id,
    );

    if (existingWaves.length > 0) {
      return NextResponse.json({
        ok: true,
        mode: "planner-waves-exist",
        parentTaskId: task.id,
        waves: existingWaves,
      });
    }

    const waveTasks = createWaveTasks(task);

    if (!validateDependencyOrder(waveTasks)) {
      return NextResponse.json(
        {
          ok: false,
          mode: "planner-waves-invalid-dependencies",
          error: "Planner waves have invalid dependency order",
        },
        { status: 400 },
      );
    }

    const updatedParentTask: AgentTask = {
      ...task,
      status: "planner-split",
      executionMode: "multi-step",
      plannerNotes:
        "This task was split into planner waves and should not be executed directly.",
    };

    const nextTasks = [
      ...waveTasks,
      ...tasks.map((candidate, index) =>
        index === taskIndex ? updatedParentTask : candidate,
      ),
    ];

    await writeGithubJson(
      TASKS_PATH,
      nextTasks,
      sha,
      `Create planner waves for task ${task.id}`,
    );

    await logActivity({
      type: "planner-waves-created",
      taskId: task.id,
      reason: "High-risk multi-step task split into planner waves",
      waveCount: waveTasks.length,
    });

    return NextResponse.json({
      ok: true,
      mode: "planner-waves-created",
      parentTaskId: task.id,
      waves: waveTasks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "planner-waves-failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
