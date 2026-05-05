import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

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
    let { tasks, sha } = await readTasksFile();

    let taskIndex = tasks.findIndex((task) => task.status === "running");

    if (taskIndex === -1) {
      taskIndex = tasks.findIndex((task) => task.status === "todo");

      if (taskIndex === -1) {
        return NextResponse.json({
          ok: true,
          mode: "idle",
          message: "No running or todo tasks found",
        });
      }

      // no GitHub write — keep in memory only
tasks = [...tasks];
tasks[taskIndex] = {
  ...tasks[taskIndex],
  status: "running",
  updatedAt: new Date().toISOString(),
};

      // skip writing done status to GitHub

    const task = tasks[taskIndex];

    if (!task.targetFile) {
      tasks = [...tasks];
      tasks[taskIndex] = {
        ...task,
        status: "failed",
        error: "Task is missing targetFile",
        updatedAt: new Date().toISOString(),
      };

     // skip writing failed status to GitHub

      return NextResponse.json({
        ok: false,
        mode: "failed",
        error: "Task is missing targetFile",
        task,
      });
    }

    const prompt = buildPrompt(task);

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

    if (!proposeRes.ok || !proposal.isSafe || proposal.changedLines >= 30) {
      const fresh = await readTasksFile();

      const updatedTasks = [...fresh.tasks];
      const freshTaskIndex = updatedTasks.findIndex((t) => t.id === task.id);

      if (freshTaskIndex !== -1) {
        updatedTasks[freshTaskIndex] = {
          ...updatedTasks[freshTaskIndex],
          status: "failed",
          error: "Proposal failed safety check",
          updatedAt: new Date().toISOString(),
        };

        await writeTasksFile(
          updatedTasks,
          fresh.sha,
          "Mark agent task as failed"
        );
      }

      return NextResponse.json({
        ok: false,
        mode: "failed",
        reason: "Proposal failed safety check",
        proposal,
      });
    }

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

    if (!applyRes.ok || !applyResult.ok) {
      const fresh = await readTasksFile();

      const updatedTasks = [...fresh.tasks];
      const freshTaskIndex = updatedTasks.findIndex((t) => t.id === task.id);

      if (freshTaskIndex !== -1) {
        updatedTasks[freshTaskIndex] = {
          ...updatedTasks[freshTaskIndex],
          status: "failed",
          error: "Apply failed",
          updatedAt: new Date().toISOString(),
        };

        await writeTasksFile(
          updatedTasks,
          fresh.sha,
          "Mark agent task as failed"
        );
      }

      return NextResponse.json({
        ok: false,
        mode: "failed",
        reason: "Apply failed",
        applyResult,
      });
    }

    const fresh = await readTasksFile();

    const updatedTasks = [...fresh.tasks];
    const freshTaskIndex = updatedTasks.findIndex((t) => t.id === task.id);

    if (freshTaskIndex !== -1) {
      updatedTasks[freshTaskIndex] = {
        ...updatedTasks[freshTaskIndex],
        status: "done",
        updatedAt: new Date().toISOString(),
        result: {
          branchName: proposal.branchName,
          pullRequestUrl: applyResult.pullRequestUrl,
          merged: applyResult.merged,
        },
      };

      await writeTasksFile(updatedTasks, fresh.sha, "Mark agent task as done");
    }

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
