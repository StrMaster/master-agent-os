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

export async function GET() {
  try {
    const tasks = await readTasks();

    const pendingTasks = Array.isArray(tasks)
      ? tasks.filter(
          (task) =>
            task &&
            (
              task.status === "pending-pr" ||
              task.status === "running"
            )
        )
      : [];

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