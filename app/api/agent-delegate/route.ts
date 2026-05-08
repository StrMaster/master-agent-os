import { NextResponse } from "next/server";
import {
  determineAgentRole,
  generateAgentDelegationResponse,
  generateReviewerFixTasks,
  generateExecutionSequence,
} from "@/app/lib/ai-task-planner";
import {
  AGENT_IDENTITIES,
} from "@/app/lib/agent-memory";
import {
  buildExecutionWaves,
} from "@/app/lib/execution-wave-manager";
import {
  addCoordinationEvent,
  getCoordinationMemory,
} from "@/app/lib/coordination-memory";

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

const coordinationMemory =
  getCoordinationMemory();

    const response =
  await generateAgentDelegationResponse({
    prompt,

    agentRole,

    projectContext: {
      ...projectContext,

      coordinationMemory,

      agentIdentity:
        AGENT_IDENTITIES[
          agentRole
        ],
    },
  });

let suggestedFixTasks: unknown[] = [];
let executionSequence:
  unknown[] = [];

if (agentRole === "reviewer") {
  try {
    suggestedFixTasks = await generateReviewerFixTasks({
      prompt,
      reviewerResponse: response,
      projectContext,
    });
  } catch (error) {
    console.error("Reviewer fix task generation failed", error);
  }
}

if (agentRole === "planner") {
  try {
    const rawSequence =
  await generateExecutionSequence({
    prompt,

    projectContext,
  });

executionSequence =
  buildExecutionWaves(
    rawSequence.map(
      (
        step: {
          id: string;

          title: string;

          summary: string;

          targetFile: string;

          priority:
            | "low"
            | "medium"
            | "high";

          dependsOn: string[];
        }
      ) => ({
        ...step,

        status: "queued",

        wave: 0,
      })
    )
  );
  } catch (error) {
    console.error(
      "Execution sequence generation failed",
      error
    );
  }
}

addCoordinationEvent({
  timestamp: Date.now(),

  agent: agentRole,

  type: "delegation",

  summary: prompt,
});

    return NextResponse.json({
  ok: true,
  mode: "agent-delegation",
  agentRole,
  response,
  suggestedFixTasks,
  executionSequence,
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