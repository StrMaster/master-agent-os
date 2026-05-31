import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

const DELETABLE_STATUSES = [
  "todo",
  "queued",
  "running",
  "pending-pr",
  "planner-required",
  "planner-split",
  "failed",
];

async function removeFromRuntimeQueue(taskId: string) {
  try {
    const { removeRuntimeTask } = await import("@/app/lib/runtime-queue");
    return await removeRuntimeTask(taskId);
  } catch (error) {
    console.warn("[delete-task] failed to remove from Redis", error);
    return false;
  }
}

async function readTasksFile() {
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
    throw new Error("Failed to read tasks file");
  }

  const file = await res.json();

  const content = Buffer.from(
    file.content,
    "base64"
  ).toString("utf-8");

  return {
    sha: file.sha,
    tasks: JSON.parse(content),
  };
}

async function writeTasksFile(
  tasks: unknown[],
  sha: string,
  message: string
) {
  const token = process.env.GITHUB_TOKEN;

  const content = Buffer.from(
    JSON.stringify(tasks, null, 2)
  ).toString("base64");

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
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
    throw new Error("Failed to update tasks file");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId.trim()
        : "";

    if (!taskId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing taskId",
        },
        { status: 400 }
      );
    }

    const { tasks, sha } = await readTasksFile();

    const existingTask = tasks.find(
      (task: any) => task.id === taskId
    );

    if (!existingTask) {
      const removedFromRuntimeQueue = await removeFromRuntimeQueue(taskId);

      if (removedFromRuntimeQueue) {
        return NextResponse.json({
          ok: true,
          deletedTaskId: taskId,
          deletedFrom: "runtime-queue",
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Task not found",
        },
        { status: 404 }
      );
    }

    if (
      !DELETABLE_STATUSES.includes(
        existingTask.status ?? ""
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete task with status: ${existingTask.status}`,
        },
        { status: 400 }
      );
    }

    const filteredTasks = tasks.filter(
      (task: any) => task.id !== taskId
    );

    await writeTasksFile(
      filteredTasks,
      sha,
      `Delete task ${taskId}`
    );

    const removedFromRuntimeQueue = await removeFromRuntimeQueue(taskId);

    return NextResponse.json({
      ok: true,
      deletedTaskId: taskId,
      deletedFrom: removedFromRuntimeQueue ? "github-and-runtime-queue" : "github",
    });

  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
