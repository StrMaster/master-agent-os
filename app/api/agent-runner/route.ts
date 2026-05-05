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
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readTasksFile(): Promise<{
  tasks: AgentTask[];
  sha: string;
}> {
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
    throw new Error(`Failed to read tasks.json: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    tasks: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeTasksFile(tasks: AgentTask[], sha: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

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
        message: "Mark agent task as running",
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

export async function GET() {
  try {
    const { tasks } = await readTasksFile();
    const nextTask = tasks.find((task) => task.status === "todo");

    return NextResponse.json({
      ok: true,
      mode: "dry-run",
      nextTask: nextTask ?? null,
      totalTasks: tasks.length,
      todoCount: tasks.filter((task) => task.status === "todo").length,
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
    const { tasks, sha } = await readTasksFile();

    const taskIndex = tasks.findIndex((task) => task.status === "running");

    if (taskIndex === -1) {
      return NextResponse.json({
        ok: true,
        message: "No running tasks found",
      });
    }

    const task = tasks[taskIndex];

    if (!task.targetFile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Running task is missing targetFile",
          task,
        },
        { status: 400 }
      );
    }

    // 👉 Generate prompt
    const prompt = `
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

    // 👉 Call propose-changes
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/propose-changes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const proposal = await res.json();

    // 👉 Safety check
if (!proposal.isSafe || proposal.changedLines >= 30) {
  const updatedTasks = [...tasks];
  updatedTasks[taskIndex] = {
    ...task,
    status: "failed",
    error: "Proposal not safe or too large",
    updatedAt: new Date().toISOString(),
  };

  await writeTasksFile(updatedTasks, sha);

  return NextResponse.json({
    ok: false,
    mode: "failed",
    reason: "Safety check failed",
    proposal,
  });
}

// 👉 Apply changes
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

// 👉 Mark done
const updatedTasks = [...tasks];
updatedTasks[taskIndex] = {
  ...task,
  status: "done",
  updatedAt: new Date().toISOString(),
  result: {
    branchName: proposal.branchName,
    merged: applyResult.merged,
  },
};

await writeTasksFile(updatedTasks, sha);

// 👉 Final response
return NextResponse.json({
  ok: true,
  mode: "applied",
  proposal,
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
