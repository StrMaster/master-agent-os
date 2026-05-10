import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

async function readTasks() {
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
    throw new Error(`Failed to read ${TASKS_PATH}`);
  }

  const file = await res.json();

  const content = Buffer.from(
    file.content,
    "base64"
  ).toString("utf-8");

  return JSON.parse(content);
}

async function isPrStillPending(prNumber?: number) {
  if (!prNumber) return true;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return true;

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return true;

  const pr = await res.json();

  return pr.state === "open" && pr.merged !== true;
}

export async function GET() {
  try {
    const tasks = await readTasks();

    const activeTasks = Array.isArray(tasks)
  ? tasks.filter(
      (task) =>
        task &&
        !task.error &&
        (
          task.status === "pending-pr" ||
          task.status === "running"
        )
    )
  : [];

const pendingTasks = [];

for (const task of activeTasks) {
  const stillPending = await isPrStillPending(
    task.result?.pullRequestNumber
  );

  if (stillPending) {
    pendingTasks.push(task);
  }
}

    return NextResponse.json({
      ok: true,
      pending: pendingTasks,
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