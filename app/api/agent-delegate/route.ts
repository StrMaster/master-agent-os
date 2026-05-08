import { NextResponse } from "next/server";
import {
  determineAgentRole,
  generateAgentDelegationResponse,
} from "@/app/lib/ai-task-planner";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();

    if (!prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing prompt",
        },
        { status: 400 }
      );
    }

    const agentRole = await determineAgentRole(prompt);

    const [tasks, activity, memory, conversationMemory] = await Promise.all([
      readGithubJson(".agent/tasks.json", []),
      readGithubJson(".agent/activity.json", []),
      readGithubJson(".agent/memory.json", {}),
      readGithubJson(".agent/conversation-memory.json", []),
    ]);

    const projectContext = {
      tasks: Array.isArray(tasks) ? tasks.slice(-20) : [],
      activity: Array.isArray(activity) ? activity.slice(0, 30) : [],
      memory,
      conversationMemory: Array.isArray(conversationMemory)
        ? conversationMemory.slice(0, 10)
        : [],
    };

    const response = await generateAgentDelegationResponse({
      prompt,
      agentRole,
      projectContext,
    });

    return NextResponse.json({
      ok: true,
      mode: "agent-delegation",
      agentRole,
      response,
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