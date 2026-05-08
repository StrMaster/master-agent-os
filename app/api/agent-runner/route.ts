import { NextResponse } from "next/server";
import {
  updateTaskStatus,
} from "@/app/lib/task-runtime";
import {
  generateCodePatch,
} from "@/app/lib/code-patch-generator";
import {
  updateGithubFile,
} from "@/app/lib/github-file-updater";
import {
  validatePatch,
} from "@/app/lib/patch-validator";
import {
  createGithubBranch,
  createPullRequest,
  findOpenPullRequest,
} from "@/app/lib/github-pr";



const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";

type AgentTask = {
  id: string;
  title: string;
  summary?: string;
  targetFile?: string;
  status: "todo" | "running" | "done" | "failed";
  priority?: "low" | "medium" | "high";
  createdAt?: string;
  dependsOn?: string[];
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

  const recentFailureCount = cooldownActivity.filter(
  (event: any) => event.type === "failed"
).length;

const cooldownSeconds = Math.min(
  30 + recentFailureCount * 15,
  300
);

if (secondsSinceFailure < cooldownSeconds) {
await logActivity({
  type: "cooldown",
  runId,
  reason: `Cooldown active after ${recentFailureCount} recent failures`,
  cooldownSeconds,
  recentFailureCount,
});
  return NextResponse.json({
    ok: false,
    mode: "cooldown",
    message: `Cooldown active (${Math.ceil(
      cooldownSeconds - secondsSinceFailure
    )}s remaining)`,
    cooldownSeconds,
    recentFailureCount,
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

const activityFile = await readActivityFile();
const activity = activityFile.activity;
const dependencyGraph = tasks.map((task) => ({
  id: task.id,
  dependsOn: task.dependsOn ?? [],
  blockedBy:
    task.dependsOn?.filter(
      (dependencyId: string) =>
        !tasks.some(
          (t) =>
            t.id === dependencyId &&
            t.status === "done"
        )
    ) ?? [],
}));
const todoTasks = tasks
  .map((task, index) => ({ task, index }))
  .filter(({ task }) => {
  if (task.status !== "todo") {
    return false;
  }

  if (!task.dependsOn?.length) {
  return true;
}

const dependenciesCompleted = task.dependsOn.every((dependencyId: string) =>
  tasks.some((t) => t.id === dependencyId && t.status === "done")
);

return dependenciesCompleted;

})
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

  const aCreatedAt = a.task.createdAt ?? new Date().toISOString();
const bCreatedAt = b.task.createdAt ?? new Date().toISOString();

const aAgeHours =
  (Date.now() - new Date(aCreatedAt).getTime()) /
  (1000 * 60 * 60);

const bAgeHours =
  (Date.now() - new Date(bCreatedAt).getTime()) /
  (1000 * 60 * 60);

const aStaleBoost = Math.min(aAgeHours / 24, 2);
const bStaleBoost = Math.min(bAgeHours / 24, 2);

const aDependencyBoost = tasks.filter(
  (t) =>
    t.dependsOn?.includes(a.task.id)
).length;

const bDependencyBoost = tasks.filter(
  (t) =>
    t.dependsOn?.includes(b.task.id)
).length;

const aScore =
  aPriority -
  aFailures +
  aStaleBoost +
  aDependencyBoost;

const bScore =
  bPriority -
  bFailures +
  bStaleBoost +
  bDependencyBoost;

  return bScore - aScore;
});

const circularDependencyTasks = tasks.filter((task) => {
  if (!task.dependsOn?.length) {
    return false;
  }

  return task.dependsOn.some((dependencyId: string) => {
    const dependencyTask = tasks.find(
      (t) => t.id === dependencyId
    );

    if (!dependencyTask?.dependsOn?.length) {
      return false;
    }

    return dependencyTask.dependsOn.includes(task.id);
  });
});

if (circularDependencyTasks.length > 0) {
  await logActivity({
    type: "circular-dependency",
    runId,
    taskId: circularDependencyTasks[0].id,
    reason: "Circular dependency detected",
  });

  return NextResponse.json({
    ok: false,
    mode: "circular-dependency",
    taskId: circularDependencyTasks[0].id,
  });
}

const dependencyBlockedTasks = tasks.filter((task) => {
  if (task.status !== "todo") {
    return false;
  }

  if (!task.dependsOn?.length) {
    return false;
  }

  return !task.dependsOn.every((dependencyId: string) =>
    tasks.some((t) => t.id === dependencyId && t.status === "done")
  );
});

if (dependencyBlockedTasks.length > 0) {
  await logActivity({
    type: "dependency-blocked",
    runId,
    taskId: dependencyBlockedTasks[0].id,
    reason: `Waiting for dependencies: ${dependencyBlockedTasks[0].dependsOn?.join(", ")}`,
    dependencyGraph,
  });
}

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

const allowedFiles = [
  "app/page.tsx",

  "app/components/ActivityFeed.tsx",

  "app/components/RunAgentButton.tsx",

  "app/agents/page.tsx",

  "app/execution/page.tsx",
];

if (
  !task.targetFile ||
  !allowedFiles.includes(
    task.targetFile
  )
)
 {
  return NextResponse.json(
    {
      ok: false,

      error:
        "Unsafe target file",
    },

    { status: 400 }
  );
}

    task.status = "running";
task.updatedAt = new Date().toISOString();

updateTaskStatus(task.id, "running");

await writeTasksFile(
  tasks,
  (await readTasksFile()).sha,
  `Mark task ${task.id} as running`
);

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

const memoryRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/memory.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const memoryData = await memoryRes.json();

const memoryContent = Buffer.from(
  memoryData.content,
  "base64"
).toString("utf-8");

const memory = JSON.parse(memoryContent);

memory.lastFailure = {
  taskId: task.id,
  timestamp: new Date().toISOString(),
  failureType: "proposal-failed",
};

const updatedMemory = Buffer.from(
  JSON.stringify(memory, null, 2) + "\n"
).toString("base64");

await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/memory.json`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Update failure memory for ${task.id}`,
      content: updatedMemory,
      sha: memoryData.sha,
      branch: BRANCH,
    }),
  }
);

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

const currentFileRes =
  await fetch(
    `https://api.github.com/repos/StrMaster/master-agent-os/contents/${task.targetFile}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,

        Accept:
          "application/vnd.github+json",
      },
    }
  );

const currentFile =
  await currentFileRes.json();

const currentContent =
  Buffer.from(
    currentFile.content,
    "base64"
  ).toString("utf-8");

const patchedContent =
  await generateCodePatch({
    filePath:
      task.targetFile,

    currentContent,

    taskTitle:
      task.title,

    taskSummary: task.summary ?? task.title,
  });

const branchName =
  `agent-task-${task.id}-${Date.now()}`;

const existingPr =
  await findOpenPullRequest(
    branchName
  );

if (existingPr) {
  await logActivity({
    type:
      "pull-request-duplicate",

    runId,

    taskId: task.id,

    summary:
      existingPr.html_url,

    reason:
      "Open PR already exists for branch",
  });

  return NextResponse.json({
    ok: true,

    mode:
      "pull-request-exists",

    pullRequest:
      existingPr.html_url,
  });
}

await createGithubBranch(
  branchName
);

await updateGithubFile(
  task.targetFile,
  patchedContent,
  `Execution Agent patch: ${task.title}`,
  branchName
);

try {
  const pr = await createPullRequest(
    branchName,
    `AI Patch: ${task.title}`,
    `
Autonomous Execution Agent PR

Task:
${task.title}

Summary:
${task.summary ?? task.title}

Generated automatically by Master Agent OS.
`
  );

  await logActivity({
    type: "pull-request-created",
    runId,
    taskId: task.id,
    summary: pr.html_url,
    pullRequestUrl: pr.html_url,
    branch: branchName,
    reason: `PR created for ${task.title}`,
  });
} catch (error) {
  await logActivity({
    type: "pull-request-failed",
    runId,
    taskId: task.id,
    branch: branchName,
    reason: "Failed to create PR",
    details: error instanceof Error ? error.message : "Unknown error",
  });

  return NextResponse.json(
    {
      ok: false,
      mode: "pull-request-failed",
      error: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 }
  );
}

const validation =
  validatePatch(
    patchedContent
  );

if (!validation.valid) {
  task.status = "failed";

  updateTaskStatus(
    task.id,
    "failed"
  );

  await logActivity({
    type: "patch-validation-failed",

    runId,

    taskId: task.id,

    reason:
      validation.issues.join(
        ", "
      ),
  });

  return NextResponse.json(
    {
      ok: false,

      error:
        "Patch validation failed",

      validation,
    },

    { status: 400 }
  );
}

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
    type: "deploy-pending",
    runId,
    taskId: task.id,
    branch: applyResult.branchName,
    provider: "vercel",
status: "pending",
    message: "Merge completed; Vercel deployment should start automatically",
  });

const memoryRes = await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/memory.json?ref=${BRANCH}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  }
);

const memoryData = await memoryRes.json();

const memoryContent = Buffer.from(
  memoryData.content,
  "base64"
).toString("utf-8");

const memory = JSON.parse(memoryContent);

const recentBranch = memory.lastBranch === applyResult.branchName;

memory.lastRun = new Date().toISOString();
memory.lastTaskId = task.id;
memory.lastBranch = applyResult.branchName;
memory.reusedBranch = recentBranch;

const updatedMemory = Buffer.from(
  JSON.stringify(memory, null, 2) + "\n"
).toString("base64");

await fetch(
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/.agent/memory.json`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Update agent memory for ${task.id}`,
      content: updatedMemory,
      sha: memoryData.sha,
      branch: BRANCH,
    }),
  }
);
}

    if (!applyResult.ok) {
task.status = "failed";
task.updatedAt = new Date().toISOString();
task.error = applyResult.error || "Apply failed";

updateTaskStatus(task.id, "failed");

await writeTasksFile(
  tasks,
  (await readTasksFile()).sha,
  `Mark task ${task.id} as failed`
);

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

task.status = "done";
task.updatedAt = new Date().toISOString();
task.result = {
  branchName: applyResult.branchName,
  pullRequestUrl: applyResult.pullRequestUrl,
  merged: applyResult.merged,
};

updateTaskStatus(task.id, "completed");

await writeTasksFile(
  tasks,
  (await readTasksFile()).sha,
  `Mark task ${task.id} as done`
);

    // 🔹 SUCCESS
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
