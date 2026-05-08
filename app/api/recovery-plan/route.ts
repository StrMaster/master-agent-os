import { NextResponse } from "next/server";
import { generateRecoveryPlan } from "@/app/lib/ai-task-planner";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

async function readGithubJson(path: string, fallback: unknown) {
  try {
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
      return fallback;
    }

    const file = await res.json();
    const content = Buffer.from(file.content, "base64").toString("utf-8");

    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const [tasks, activity, memory] = await Promise.all([
      readGithubJson(".agent/tasks.json", []),
      readGithubJson(".agent/activity.json", []),
      readGithubJson(".agent/memory.json", {}),
    ]);

    const failedTask =
      Array.isArray(tasks)
        ? [...tasks].reverse().find((task: any) => task.status === "failed")
        : null;

    if (!failedTask) {
      return NextResponse.json({
        ok: false,
        mode: "no-failed-task",
        message: "No failed task found",
      });
    }

    const recoveryTask = await generateRecoveryPlan({
      failedTask,
      recentActivity: Array.isArray(activity) ? activity.slice(0, 30) : [],
      memory,
    });

    return NextResponse.json({
      ok: true,
      mode: "recovery-plan",
      failedTask,
      recoveryTask,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}