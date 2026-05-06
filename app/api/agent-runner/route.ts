import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

type AgentTask = {
  id: string;
  title: string;
  targetFile?: string;
  status: "todo" | "running" | "done" | "failed";
  priority?: "low" | "medium" | "high";
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  result?: {
    branchName?: string;
    pullRequestUrl?: string;
    merged?: boolean;
  };
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readTasksFile(): Promise<{ tasks: AgentTask[]; sha: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

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
    throw new Error(`Failed to read tasks.json: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    tasks: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeTasksFile(
  tasks: AgentTask[],
  sha: string,
  message: string
) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN");

  const content = Buffer.from(JSON.stringify(tasks, null, 2) + "\n").toString(
    "base64"
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}`,
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
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write tasks.json: ${res.status} ${text}`);
  }
}

async function readActivityFile(): Promise<{
  activity: any[];
  sha: string;
}> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ACTIVITY_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to read activity.json: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;

  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    activity: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeActivityFile(activity: any[], sha: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(
    JSON.stringify(activity, null, 2) + "\n"
  ).toString("base64");

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ACTIVITY_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Update agent activity",
        content,
        sha,
        branch: BRANCH,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write activity: ${res.status} ${text}`);
  }
}

async function logActivity(event: any) {
  const current = await readActivityFile();

  const updated = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...current.activity,
  ].slice(0, 100);

  await writeActivityFile(updated, current.sha);
}

function buildPrompt(task: AgentTask) {
  return `
Make a small safe change in ${task.targetFile}.

Task:
${task.title}

Constraints:
- Modify only ${task.targetFile}
- Change exactly one file
- No imports
- No refactoring
- No dependency changes
- No config changes
- Keep the change under 30 changed lines
- Prefer copy, labels, or small UI improvements only
`;
}

export async function GET() {
  try {
    const { tasks } = await readTasksFile();

    return NextResponse.json({
      ok: true,
      mode: "status",
      runningTask: tasks.find((task) => task.status === "running") ?? null,
      nextTodoTask: tasks.find((task) => task.status === "todo") ?? null,
      totalTasks: tasks.length,
      todoCount: tasks.filter((task) => task.status === "todo").length,
      runningCount: tasks.filter((task) => task.status === "running").length,
      doneCount: tasks.filter((task) => task.status === "done").length,
      failedCount: tasks.filter((task) => task.status === "failed").length,
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

export async function POST() {
  try {
    let { tasks } = await readTasksFile();

    let taskIndex = tasks.findIndex((task) => task.status === "todo");

    if (taskIndex === -1) {
      return NextResponse.json({
        ok: true,
        mode: "idle",
        message: "No todo tasks found",
      });
    }

    const task = tasks[taskIndex];

    if (!task.targetFile) {
      return NextResponse.json({
        ok: false,
        mode: "failed",
        error: "Task is missing targetFile",
        task,
      });
    }

    const prompt = buildPrompt(task);

    // 🔹 PROPOSE
    const proposeRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/propose-changes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      }
    );

    const proposal = await proposeRes.json();
    
    await logActivity({
  type: "proposal",
  taskId: task.id,
  summary: proposal.summary,
  changedLines: proposal.changedLines,
  safe: proposal.isSafe,
});

    if (!proposal.isSafe || proposal.changedLines >= 30) {
      return NextResponse.json({
        ok: false,
        mode: "failed",
        reason: "Proposal failed safety",
        proposal,
      });
    }

    // 🔹 APPLY
    const applyRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/apply-changes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proposal),
      }
    );

    const applyResult = await applyRes.json();

    await logActivity({
  type: "apply",
  taskId: task.id,
  branch: applyResult.branchName,
  merged: applyResult.merged,
  pullRequestUrl: applyResult.pullRequestUrl,
});

    if (!applyResult.ok) {
      return NextResponse.json({
        ok: false,
        mode: "failed",
        reason: "Apply failed",
        applyResult,
      });
    }

    // 🔹 SUCCESS (no GitHub task write)
    return NextResponse.json({
      ok: true,
      mode: "completed-one-task",
      taskId: task.id,
      proposal: {
        summary: proposal.summary,
        branchName: proposal.branchName,
        isSafe: proposal.isSafe,
        changedLines: proposal.changedLines,
      },
      applyResult,
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
