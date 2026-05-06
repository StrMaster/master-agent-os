import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

const SAFE_TARGET_FILES = [
  "app/execution/page.tsx",
  "app/agents/page.tsx",
  "app/components/RunAgentButton.tsx",
];

const TASK_TEMPLATES = [
  "Improve empty state message clarity",
  "Improve section title wording",
  "Improve spacing and readability",
  "Improve helper text clarity",
  "Improve button label wording",
  "Improve card readability",
  "Improve status label clarity",
];

type AgentTask = {
  id: string;
  title: string;
  targetFile: string;
  status: "todo";
  priority: "low";
  createdAt: string;
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readTasksFile(): Promise<{
  tasks: any[];
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

async function writeTasksFile(tasks: any[], sha: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(
    JSON.stringify(tasks, null, 2) + "\n"
  ).toString("base64");

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
        message: "Generate autonomous agent task",
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

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function POST() {
  try {
    const { tasks, sha } = await readTasksFile();

    const title = randomItem(TASK_TEMPLATES);
    const targetFile = randomItem(SAFE_TARGET_FILES);

    const task: AgentTask = {
      id: `task-${Date.now()}`,
      title,
      targetFile,
      status: "todo",
      priority: "low",
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = [...tasks, task];

    await writeTasksFile(updatedTasks, sha);

    return NextResponse.json({
      ok: true,
      mode: "generated-task",
      task,
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