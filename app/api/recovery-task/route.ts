import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

type RecoveryTaskInput = {
  reason?: string;
  stopCode?: string;
  targetFile?: string;
  suggestedAction?: string;
  targetArea?: string;
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
    "Log recovery task activity",
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RecoveryTaskInput;

    const reason = body.reason?.trim() || "Recovery mode requires attention";
    const stopCode = body.stopCode?.trim() || "recovery-required";
    const targetFile = body.targetFile?.trim() || "app/api/agent-runner/route.ts";

    const suggestedAction =
  body.suggestedAction?.trim() ||
  "Review the failure reason, inspect the target area, and apply the smallest safe fix.";

const targetArea =
  body.targetArea?.trim() ||
  "runtime/recovery";

    const { json, sha } = await readGithubJson(TASKS_PATH, []);

    if (!sha) {
      throw new Error(`Missing ${TASKS_PATH}`);
    }

    const tasks = Array.isArray(json) ? json : [];

    const duplicate = tasks.find(
      (task) =>
        task &&
        task.source === "recovery" &&
        task.status === "todo" &&
        task.targetFile === targetFile &&
        task.stopCode === stopCode,
    );

    if (duplicate) {
      return NextResponse.json({
        ok: true,
        mode: "recovery-task-exists",
        task: duplicate,
      });
    }

    const task = {
      id: `recovery-task-${Date.now()}`,
      title: `Recovery: ${reason}`,
      summary: `Investigate and fix recovery condition: ${reason}. Suggested action: ${suggestedAction}`,
      targetFile,
      status: "todo",
      priority: "high",
      source: "recovery",
      stopCode,
suggestedAction,
targetArea,
intent: "recovery",
riskLevel: "medium",
executionMode: "single-file",
wave: 1,
plannerNotes: `Recovery task for stopCode: ${stopCode}. Reason: ${reason}. Suggested action: ${suggestedAction}. Keep scope narrow, avoid broad rewrites.`,
    };

    const updatedTasks = [task, ...tasks];

    await writeGithubJson(
      TASKS_PATH,
      updatedTasks,
      sha,
      "Create recovery task",
    );

    await logActivity({
  type: "recovery-task-created",
  taskId: task.id,
  targetFile,
  reason,
  stopCode,
  suggestedAction,
  targetArea,
});

    return NextResponse.json({
      ok: true,
      mode: "recovery-task-created",
      task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "recovery-task-failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
