import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

const ACTIVE_QUEUE_STATUSES = ["queued", "running", "pending-pr"];

type AgentTask = {
  id: string;
  title?: string;
  status?: string;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  updatedAt?: string;
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
    },
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
  const { json, sha } = await readGithubJson(ACTIVITY_PATH);
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
    "Log planner task approval",
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const taskId = String(body.taskId ?? "").trim();
    const approvedBy =
      typeof body.approvedBy === "string" && body.approvedBy.trim()
        ? body.approvedBy.trim()
        : "system";

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

    const { json, sha } = await readGithubJson(TASKS_PATH);
    const tasks = Array.isArray(json) ? (json as AgentTask[]) : [];
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return NextResponse.json(
        {
          ok: false,
          mode: "task-not-found",
          error: "Task not found",
        },
        { status: 404 },
      );
    }

    const task = tasks[taskIndex];

    if (ACTIVE_QUEUE_STATUSES.includes(task.status ?? "")) {
      return NextResponse.json({
        ok: true,
        mode: "task-already-queued",
        task,
      });
    }

    if (!task.previewOnly && !task.requiresApproval) {
      return NextResponse.json({
        ok: true,
        mode: "task-already-approved",
        task,
      });
    }

    const approvedAt = new Date().toISOString();

    const approvedTask: AgentTask = {
      ...task,
      previewOnly: false,
      requiresApproval: false,
      approvedAt,
      approvedBy,
      updatedAt: approvedAt,
      status: "queued",
    };

    const nextTasks = tasks.map((candidate, index) =>
      index === taskIndex ? approvedTask : candidate,
    );

    await writeGithubJson(
      TASKS_PATH,
      nextTasks,
      sha,
      `Approve planner preview task ${task.id}`,
    );

    await logActivity({
      type: "planner-task-approved",
      taskId: task.id,
      approvedBy,
      previewOnly: false,
      requiresApproval: false,
      status: "queued",
    });

    return NextResponse.json({
      ok: true,
      mode: "task-approved",
      task: approvedTask,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
