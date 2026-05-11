import { NextResponse } from "next/server";
import { generateProjectStatusSummary } from "@/app/lib/ai-task-planner";
import { buildControlSummary } from "@/agents/core/control-communication";

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
    const [tasks, activity, memory, conversationMemory] = await Promise.all([
      readGithubJson(".agent/tasks.json", []),
      readGithubJson(".agent/activity.json", []),
      readGithubJson(".agent/memory.json", {}),
      readGithubJson(".agent/conversation-memory.json", []),
    ]);

    const summary = await generateProjectStatusSummary({
      tasks: Array.isArray(tasks) ? tasks.slice(-20) : [],
      activity: Array.isArray(activity) ? activity.slice(0, 30) : [],
      memory,
      conversationMemory: Array.isArray(conversationMemory)
        ? conversationMemory.slice(0, 15)
        : [],
    });
    const controlSummary = await buildControlSummary();

    return NextResponse.json({
      ok: true,
      mode: "project-status",
      summary,
      controlSummary,
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
