import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

type AgentTask = {
  id: string;
  title?: string;
  status?: string;
  wave?: number;
  waveStatus?: "ready" | "blocked" | "completed";
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  parentTaskId?: string;
  dependsOnTaskIds?: string[];
  blockedBy?: string[];
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readGithubJson(path: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

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

  if (!res.ok) throw new Error(`Failed to read ${path}: ${res.status}`);

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return { json: JSON.parse(content), sha: file.sha };
}

async function writeGithubJson(
  path: string,
  json: unknown,
  sha: string,
  message: string,
) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

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
    throw new Error(`Failed to write ${path}: ${res.status} ${await res.text()}`);
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
    "Log planner wave approval",
  );
}

function isWaveDone(task: AgentTask) {
  return (
    task.status === "done" ||
    task.status === "completed" ||
    task.approvedAt !== undefined ||
    task.previewOnly !== true && task.requiresApproval !== true
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
        { ok: false, mode: "missing-task-id", error: "taskId is required" },
        { status: 400 },
      );
    }

    const { json, sha } = await readGithubJson(TASKS_PATH);
    const tasks = Array.isArray(json) ? (json as AgentTask[]) : [];
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      return NextResponse.json(
        { ok: false, mode: "task-not-found", error: "Task not found" },
        { status: 404 },
      );
    }

    if (typeof task.wave !== "number" || !task.parentTaskId) {
      return NextResponse.json(
        {
          ok: false,
          mode: "not-wave-task",
          error: "Task is not part of a planner wave",
        },
        { status: 400 },
      );
    }

    const waveNumber = task.wave;

    const waveTasks = tasks.filter(
      (candidate) =>
        candidate.parentTaskId === task.parentTaskId &&
        candidate.wave === waveNumber,
    );

    const earlierWavesDone = tasks
      .filter(
        (candidate) =>
          candidate.parentTaskId === task.parentTaskId &&
          typeof candidate.wave === "number" &&
          candidate.wave < waveNumber,
      )
      .every(isWaveDone);

    const dependenciesSatisfied = waveTasks.every((waveTask) =>
      (waveTask.dependsOnTaskIds ?? waveTask.blockedBy ?? []).every(
        (dependencyId) => {
          const dependency = tasks.find((candidate) => candidate.id === dependencyId);
          return Boolean(
            dependency &&
              (dependency.status === "done" ||
                dependency.status === "completed" ||
                dependency.approvedAt),
          );
        },
      ),
    );

    if (!earlierWavesDone && !dependenciesSatisfied) {
      return NextResponse.json(
        {
          ok: false,
          mode: "wave-blocked",
          error: "Earlier waves or required dependencies are not ready yet",
        },
        { status: 400 },
      );
    }

    const approvedAt = new Date().toISOString();

    const nextTasks = tasks.map((candidate) =>
      candidate.parentTaskId === task.parentTaskId &&
      candidate.wave === waveNumber
        ? {
            ...candidate,
            previewOnly: false,
            requiresApproval: false,
            approvedAt,
            approvedBy,
            waveStatus: "ready",
            status: candidate.status ?? "todo",
          }
        : candidate,
    );

    await writeGithubJson(
      TASKS_PATH,
      nextTasks,
      sha,
      `Approve planner wave ${task.parentTaskId}:${waveNumber}`,
    );

    await logActivity({
      type: "planner-wave-approved",
      parentTaskId: task.parentTaskId,
      wave: waveNumber,
      approvedBy,
      approvedCount: waveTasks.length,
    });

    return NextResponse.json({
      ok: true,
      mode: "wave-approved",
      parentTaskId: task.parentTaskId,
      wave: waveNumber,
      approvedCount: waveTasks.length,
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
