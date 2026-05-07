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

async function pauseAgent(reason: string) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/state.json?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to read state.json: ${res.status}`);
  }

  const file = await res.json();

  const newState = {
    paused: true,
    reason,
    updatedAt: new Date().toISOString(),
  };

  const content = Buffer.from(
    JSON.stringify(newState, null, 2) + "\n"
  ).toString("base64");

  const writeRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/state.json`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Auto-pause agent after repeated failures",
        content,
        sha: file.sha,
        branch: BRANCH,
      }),
    }
  );

  if (!writeRes.ok) {
    const text = await writeRes.text();
    throw new Error(`Failed to pause agent: ${writeRes.status} ${text}`);
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

function buildRetryPrompt(task: AgentTask, reason: string) {
  return `
Make a smaller and safer change in ${task.targetFile}.

Original task:
${task.title}

Previous attempt failed because:
${reason}

Retry constraints:
- Modify only ${task.targetFile}
- Change exactly one file
- Make the smallest possible change
- Prefer changing only text/copy
- No imports
- No refactoring
- No dependency changes
- No config changes
- Keep the change under 10 changed lines
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
    const runId = crypto.randomUUID();
    let { tasks } = await readTasksFile();

const cooldownRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/activity.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const cooldownData = await cooldownRes.json();

const cooldownContent = Buffer.from(
  cooldownData.content,
  "base64"
).toString("utf-8");

const cooldownActivity = JSON.parse(cooldownContent);

const latestFailure = cooldownActivity.find(
  (event: any) => event.type === "failed"
);

if (latestFailure) {
  const failureTime = new Date(latestFailure.timestamp).getTime();

  const secondsSinceFailure =
    (Date.now() - failureTime) / 1000;

  if (secondsSinceFailure < 30) {
    return NextResponse.json({
      ok: false,
      mode: "cooldown",
      message: `Cooldown active (${Math.ceil(
        30 - secondsSinceFailure
      )}s remaining)`,
    });
  }
}

const stateRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/state.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

if (!stateRes.ok) {
  throw new Error(`Failed to read state.json: ${stateRes.status}`);
}

const stateData = await stateRes.json();

const stateContent = Buffer.from(
  stateData.content,
  "base64"
).toString("utf-8");

const agentState = JSON.parse(stateContent);

if (agentState.paused) {
  return NextResponse.json({
    ok: false,
    mode: "paused",
    message: "Agent is paused",
  });
}

const priorityRank = {
  high: 3,
  medium: 2,
  low: 1,
};

let taskIndex = -1;

const todoTasks = tasks
  .map((task, index) => ({ task, index }))
  .filter(({ task }) => task.status === "todo")
  .sort((a, b) => {
  const aPriority = priorityRank[a.task.priority ?? "low"];
  const bPriority = priorityRank[b.task.priority ?? "low"];

  const aFailures = activity.filter(
    (event: any) =>
      event.type === "failed" &&
      event.taskId === a.task.id
  ).length;

  const bFailures = activity.filter(
    (event: any) =>
      event.type === "failed" &&
      event.taskId === b.task.id
  ).length;

  const aScore = aPriority - aFailures;
  const bScore = bPriority - bFailures;

  return bScore - aScore;
});

if (todoTasks.length > 0) {
  taskIndex = todoTasks[0].index;
}
    
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
    
    let proposal = await proposeRes.json();

await logActivity({
  type: "proposal",
  runId,
  taskId: task.id,
  summary: proposal.summary,
  changedLines: proposal.changedLines,
  safe: proposal.isSafe,
});

if (proposal.mode === "blocked") {
  await logActivity({
    type: "blocked",
    runId,
    taskId: task.id,
    reason: proposal.error,
  });

  return NextResponse.json({
    ok: false,
    mode: "blocked",
    error: proposal.error,
    proposal,
  });
}

if (!proposal.isSafe || proposal.changedLines >= 30) {
  await logActivity({
    type: "failed",
    runId,
    taskId: task.id,
    reason: "Proposal failed safety",
    changedLines: proposal.changedLines,
    safe: proposal.isSafe,
  });

const activityRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/activity.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const activityData = await activityRes.json();

const activityContent = Buffer.from(
  activityData.content,
  "base64"
).toString("utf-8");

const activity = JSON.parse(activityContent);

const recentFailures = activity.filter(
  (event: any) =>
    event.type === "failed" &&
    event.taskId === task.id
).length;

if (recentFailures >= 3) {
  await logActivity({
    type: "threshold-reached",
    runId,
    taskId: task.id,
    failures: recentFailures,
  });

await pauseAgent(`Task ${task.id} failed ${recentFailures} times`);
await logActivity({
  type: "auto-paused",
  runId,
  taskId: task.id,
  reason: `Task ${task.id} failed ${recentFailures} times`,
});
  return NextResponse.json({
    ok: false,
    mode: "threshold-reached",
    message: `Task failed ${recentFailures} times`,
  });
}

  const retryPrompt = buildRetryPrompt(task, "Proposal failed safety check");

  const retryRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/propose-changes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: retryPrompt }),
    }
  );

  proposal = await retryRes.json();

  await logActivity({
    type: "retry",
    runId,
    taskId: task.id,
    reason: "Retried proposal with stricter prompt",
    changedLines: proposal.changedLines,
    safe: proposal.isSafe,
    failureType: "proposal-failed",
  });

if (proposal.mode === "blocked") {
  await logActivity({
    type: "blocked",
    runId,
    taskId: task.id,
    reason: proposal.error,
    failureType: "blocked",
  });

  return NextResponse.json({
    ok: false,
    mode: "blocked",
    error: proposal.error,
    proposal,
  });
}

  if (!proposal.isSafe || proposal.changedLines >= 30) {
    return NextResponse.json({
      ok: false,
      mode: "failed",
      reason: "Proposal failed safety after retry",
      proposal,
    });
  }
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
  runId,
  taskId: task.id,
  branch: applyResult.branchName,
  merged: applyResult.merged,
  pullRequestUrl: applyResult.pullRequestUrl,
});

if (applyResult.merged) {
  await logActivity({
    type: "deploy-triggered",
    runId,
    taskId: task.id,
    branch: applyResult.branchName,
  });
}

    if (!applyResult.ok) {
await logActivity({
  type: "failed",
  runId,
  taskId: task.id,
  reason: "Apply failed",
  details: applyResult.error || null,
  failureType: applyResult?.error
  ? "apply-failed"
  : "unknown",
});
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
