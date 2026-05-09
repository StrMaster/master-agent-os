import { NextResponse } from "next/server";
import { generateCodePatch } from "@/app/lib/code-patch-generator";
import { updateGithubFile } from "@/app/lib/github-file-updater";
import {
  createGithubBranch,
  createPullRequest,
  findOpenPullRequest,
  mergePullRequest,
  validatePullRequest,
} from "@/app/lib/github-pr";
import { validatePatch } from "@/app/lib/patch-validator";
import { updateTaskStatus } from "@/app/lib/task-runtime";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

const TASKS_PATH = ".agent/tasks.json";
const ACTIVITY_PATH = ".agent/activity.json";
const STATE_PATH = ".agent/state.json";

const RUNNER_COOLDOWN_MS = 15_000;
const RUNNER_STALE_LOCK_MS = 5 * 60 * 1000;

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/components/ActivityFeed.tsx",
  "app/components/RunAgentButton.tsx",
  "app/agents/page.tsx",
  "app/execution/page.tsx",
];

type Priority = "low" | "medium" | "high";

type AgentTaskStatus =
  | "todo"
  | "running"
  | "done"
  | "failed"
  | "pending-pr";

type AgentTask = {
  id: string;
  title: string;
  summary?: string;
  targetFile?: string;
  status: AgentTaskStatus;
  priority?: Priority;
  dependsOn?: string[];
  createdAt?: string;
  updatedAt?: string;
  error?: string;
    result?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    merged?: boolean;
  };
};

type AgentState = {
  paused?: boolean;
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readGithubJson(path: string) {
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
    throw new Error(`Failed to read ${path}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    json: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeGithubJson(
  path: string,
  json: unknown,
  sha: string,
  message: string
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64"
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
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
    throw new Error(`Failed to write ${path}: ${res.status} ${text}`);
  }
}

async function readTasksFile() {
  const { json, sha } = await readGithubJson(TASKS_PATH);

  return {
    tasks: Array.isArray(json) ? (json as AgentTask[]) : [],
    sha,
  };
}

async function writeTasksFile(tasks: AgentTask[], sha: string, message: string) {
  await writeGithubJson(TASKS_PATH, tasks, sha, message);
}

async function readActivityFile() {
  const { json, sha } = await readGithubJson(ACTIVITY_PATH);

  return {
    activity: Array.isArray(json) ? json : [],
    sha,
  };
}

async function logActivity(event: Record<string, unknown>) {
  const { activity, sha } = await readActivityFile();

  const updatedActivity = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...activity,
  ].slice(0, 150);

  await writeGithubJson(
    ACTIVITY_PATH,
    updatedActivity,
    sha,
    "Log agent activity"
  );
}

async function readStateFile() {
  const { json, sha } = await readGithubJson(STATE_PATH);

  return {
    state: (json || {}) as AgentState,
    sha,
  };
}

async function writeStateFile(
  state: AgentState,
  sha: string,
  message: string
) {
  await writeGithubJson(STATE_PATH, state, sha, message);
}

async function releaseRunnerLock() {
  try {
    const { state, sha } = await readStateFile();

    await writeStateFile(
  {
    ...state,
    runnerLocked: false,
    runnerLockStartedAt: undefined,
  },
  sha,
  "Release agent runner lock"
);
  } catch {
    // Do not throw from cleanup.
  }
}

async function readTargetFile(path: string) {
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
    throw new Error(`Failed to read target file ${path}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;

  return Buffer.from(file.content, "base64").toString("utf-8");
}

function priorityScore(priority?: Priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function hasCircularDependency(tasks: AgentTask[]) {
  return tasks.find((task) => {
    if (!task.dependsOn?.length) {
      return false;
    }

    return task.dependsOn.some((dependencyId) => {
      const dependencyTask = tasks.find(
        (candidate) => candidate.id === dependencyId
      );

      return dependencyTask?.dependsOn?.includes(task.id);
    });
  });
}

function dependenciesCompleted(task: AgentTask, tasks: AgentTask[]) {
  if (!task.dependsOn?.length) {
    return true;
  }

  return task.dependsOn.every((dependencyId) =>
    tasks.some(
      (candidate) =>
        candidate.id === dependencyId && candidate.status === "done"
    )
  );
}

function selectNextTask(tasks: AgentTask[], activity: any[]) {
  const candidates = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === "todo")
    .filter(({ task }) => dependenciesCompleted(task, tasks))
    .sort((a, b) => {
      const aFailures = activity.filter(
        (event: any) => event.type === "failed" && event.taskId === a.task.id
      ).length;

      const bFailures = activity.filter(
        (event: any) => event.type === "failed" && event.taskId === b.task.id
      ).length;

      const aCreatedAt = a.task.createdAt ?? new Date().toISOString();
      const bCreatedAt = b.task.createdAt ?? new Date().toISOString();

      const aAgeHours =
        (Date.now() - new Date(aCreatedAt).getTime()) / (1000 * 60 * 60);

      const bAgeHours =
        (Date.now() - new Date(bCreatedAt).getTime()) / (1000 * 60 * 60);

      const aStaleBoost = Math.min(aAgeHours / 24, 2);
      const bStaleBoost = Math.min(bAgeHours / 24, 2);

      const aDependencyBoost = tasks.filter((task) =>
        task.dependsOn?.includes(a.task.id)
      ).length;

      const bDependencyBoost = tasks.filter((task) =>
        task.dependsOn?.includes(b.task.id)
      ).length;

      const aScore =
        priorityScore(a.task.priority) -
        aFailures +
        aStaleBoost +
        aDependencyBoost;

      const bScore =
        priorityScore(b.task.priority) -
        bFailures +
        bStaleBoost +
        bDependencyBoost;

      return bScore - aScore;
    });

  return candidates[0] ?? null;
}

export async function GET() {
  try {
    const { tasks } = await readTasksFile();

    return NextResponse.json({
      ok: true,
      totalTasks: tasks.length,
      todoCount: tasks.filter((task) => task.status === "todo").length,
      runningCount: tasks.filter((task) => task.status === "running").length,
      pendingPrCount: tasks.filter((task) => task.status === "pending-pr")
        .length,
      doneCount: tasks.filter((task) => task.status === "done").length,
      failedCount: tasks.filter((task) => task.status === "failed").length,
      nextTodoTask: tasks.find((task) => task.status === "todo") ?? null,
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
  const runId = crypto.randomUUID();
  let lockAcquired = false;

  try {
    const { state, sha: stateSha } = await readStateFile();
    const now = Date.now();

    if (state.emergencyStop) {
  await logActivity({
    type: "emergency-stop-active",
    runId,
    reason: "Emergency stop is active",
  }).catch(() => {});

  return NextResponse.json({
    ok: false,
    mode: "emergency-stop",
    message: "Emergency stop is active",
  });
}

    if (state.paused) {
      return NextResponse.json({
        ok: false,
        mode: "paused",
        message: "Agent is paused",
      });
    }

    if (state.runnerLocked) {
  const lockAge = state.runnerLockStartedAt
    ? now - state.runnerLockStartedAt
    : 0;

  const isStaleLock =
    !state.runnerLockStartedAt || lockAge > RUNNER_STALE_LOCK_MS;

  if (!isStaleLock) {
    await logActivity({
      type: "runner-busy",
      runId,
      reason: "Agent runner already active",
      lockAgeMs: lockAge,
    }).catch(() => {});

    return NextResponse.json({
      ok: false,
      mode: "runner-busy",
      error: "Agent runner already active",
      lockAgeMs: lockAge,
    });
  }

  await logActivity({
    type: "runner-stale-lock-recovered",
    runId,
    reason: "Recovered stale runner lock",
    lockAgeMs: lockAge,
  }).catch(() => {});
}

    if (state.lastRunAt && now - state.lastRunAt < RUNNER_COOLDOWN_MS) {
      const retryAfterMs = RUNNER_COOLDOWN_MS - (now - state.lastRunAt);
        await logActivity({
        type: "runner-cooldown",
        runId,
        reason: "Runner cooldown active",
      }).catch(() => {});

      return NextResponse.json({
  ok: false,
  mode: "cooldown",
  error: "Runner cooldown active",
  retryAfterMs,
});
    }

    await writeStateFile(
  {
    ...state,
    runnerLocked: true,
    runnerLockStartedAt: now,
    lastRunAt: now,
  },
  stateSha,
  "Acquire agent runner lock"
);

    lockAcquired = true;

    const { tasks, sha } = await readTasksFile();
    const { activity } = await readActivityFile();

    const circularTask = hasCircularDependency(tasks);

    if (circularTask) {
      await logActivity({
        type: "circular-dependency",
        runId,
        taskId: circularTask.id,
        reason: "Circular dependency detected",
      });

      return NextResponse.json({
        ok: false,
        mode: "circular-dependency",
        taskId: circularTask.id,
      });
    }

    const selected = selectNextTask(tasks, activity);

    if (!selected) {
      return NextResponse.json({
        ok: true,
        mode: "idle",
        message: "No runnable todo tasks",
      });
    }

    const task = selected.task;
    const taskIndex = selected.index;

        if (task.result?.pullRequestUrl) {
      task.status = "pending-pr";
      task.updatedAt = new Date().toISOString();
      tasks[taskIndex] = task;

      await writeTasksFile(
        tasks,
        sha,
        `Keep task ${task.id} pending existing PR`
      );

      await logActivity({
        type: "duplicate-pr-blocked",
        runId,
        taskId: task.id,
        pullRequestUrl: task.result.pullRequestUrl,
        reason: "Task already has a pull request",
      });

      updateTaskStatus(task.id, "pending-pr");

      return NextResponse.json({
        ok: true,
        mode: "existing-pr",
        taskId: task.id,
        pullRequestUrl: task.result.pullRequestUrl,
      });
    }

    if (!task.targetFile || !SAFE_TARGET_FILES.includes(task.targetFile)) {
      await logActivity({
        type: "blocked",
        runId,
        taskId: task.id,
        reason: `Unsafe or missing targetFile: ${task.targetFile ?? "missing"}`,
        failureType: "blocked",
      });

      return NextResponse.json(
        {
          ok: false,
          mode: "blocked",
          error: "Unsafe or missing targetFile",
          task,
        },
        { status: 400 }
      );
    }

    task.status = "running";
    task.updatedAt = new Date().toISOString();
    tasks[taskIndex] = task;

    updateTaskStatus(task.id, "running");

    await writeTasksFile(tasks, sha, `Mark task ${task.id} as running`);

    await logActivity({
      type: "execution-started",
      runId,
      taskId: task.id,
      summary: task.title,
      targetFile: task.targetFile,
      priority: task.priority,
    });

    const currentContent = await readTargetFile(task.targetFile);

    const patchedContent = await generateCodePatch({
      filePath: task.targetFile,
      currentContent,
      taskTitle: task.title,
      taskSummary: task.summary ?? task.title,
    });

    const validation = validatePatch(patchedContent);

    if (!validation.valid) {
      const latest = await readTasksFile();
      const latestTask = latest.tasks.find(
        (candidate) => candidate.id === task.id
      );

      if (latestTask) {
        latestTask.status = "failed";
        latestTask.updatedAt = new Date().toISOString();
        latestTask.error = `Patch validation failed: ${validation.issues.join(
          ", "
        )}`;
      }

      updateTaskStatus(task.id, "failed");

      await writeTasksFile(
        latest.tasks,
        latest.sha,
        `Mark task ${task.id} as failed after patch validation`
      );

      await logActivity({
        type: "patch-validation-failed",
        runId,
        taskId: task.id,
        reason: validation.issues.join(", "),
      });

      return NextResponse.json(
        {
          ok: false,
          mode: "patch-validation-failed",
          validation,
        },
        { status: 400 }
      );
    }

        const branchName = task.result?.branchName ?? `agent-task-${task.id}`;

        const existingPr = await findOpenPullRequest(branchName);

    if (existingPr?.html_url) {
      const latest = await readTasksFile();
      const latestTask = latest.tasks.find(
        (candidate) => candidate.id === task.id
      );

      if (latestTask) {
        latestTask.status = "pending-pr";
        latestTask.updatedAt = new Date().toISOString();
        latestTask.result = {
          branchName,
          pullRequestUrl: existingPr.html_url,
          pullRequestNumber: existingPr.number,
          merged: false,
        };
      }

      updateTaskStatus(task.id, "pending-pr");

      await writeTasksFile(
        latest.tasks,
        latest.sha,
        `Mark task ${task.id} as pending existing PR`
      );

      await logActivity({
        type: "duplicate-pr-blocked",
        runId,
        taskId: task.id,
        branch: branchName,
        pullRequestUrl: existingPr.html_url,
        reason: "Open pull request already exists for this task branch",
      });

      return NextResponse.json({
        ok: true,
        mode: "existing-pr",
        taskId: task.id,
        branchName,
        pullRequestUrl: existingPr.html_url,
      });
    }

    await createGithubBranch(branchName);

    await updateGithubFile(
      task.targetFile,
      patchedContent,
      `Execution Agent patch: ${task.title}`,
      branchName
    );

    const pr = await createPullRequest(
      branchName,
      `AI Patch: ${task.title}`,
      `
Autonomous Execution Agent PR

Task:
${task.title}

Summary:
${task.summary ?? task.title}

Target file:
${task.targetFile}

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

    let prValidation = null;

    if (typeof pr.number === "number") {
      try {
        prValidation = await validatePullRequest(pr.number);

        await logActivity({
          type: "pull-request-validated",
          runId,
          taskId: task.id,
          reason: prValidation.mergeable
            ? "PR is mergeable"
            : "PR not mergeable yet",
          details: JSON.stringify(prValidation),
        });
      } catch (error) {
        await logActivity({
          type: "pull-request-validation-failed",
          runId,
          taskId: task.id,
          reason: "PR validation failed",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    let mergeResult = null;

if (state.autoMergeEnabled && typeof pr.number === "number") {
  const canAutoMerge =
    prValidation &&
    prValidation.mergeable === true &&
    prValidation.draft !== true &&
    prValidation.merged !== true &&
    prValidation.state === "open" &&
    task.targetFile &&
    SAFE_TARGET_FILES.includes(task.targetFile);

  if (canAutoMerge) {
    try {
      mergeResult = await mergePullRequest(pr.number);

      await logActivity({
        type: "pull-request-merged",
        runId,
        taskId: task.id,
        branch: branchName,
        pullRequestUrl: pr.html_url,
        reason: "Auto-merge completed successfully",
        details: JSON.stringify(mergeResult),
      });
    } catch (error) {
      await logActivity({
        type: "pull-request-merge-failed",
        runId,
        taskId: task.id,
        branch: branchName,
        pullRequestUrl: pr.html_url,
        reason: "Auto-merge failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    await logActivity({
      type: "auto-merge-blocked",
      runId,
      taskId: task.id,
      branch: branchName,
      pullRequestUrl: pr.html_url,
      reason: "Auto-merge blocked by safety checks",
      details: JSON.stringify({
        autoMergeEnabled: state.autoMergeEnabled,
        hasValidation: Boolean(prValidation),
        mergeable: prValidation?.mergeable,
        draft: prValidation?.draft,
        merged: prValidation?.merged,
        state: prValidation?.state,
        safeTargetFile:
          Boolean(task.targetFile) && SAFE_TARGET_FILES.includes(task.targetFile),
      }),
    });
  }
}

    if (state.autoMergeEnabled) {
  await logActivity({
    type: "auto-merge-blocked",
    runId,
    taskId: task.id,
    branch: branchName,
    pullRequestUrl: pr.html_url,
    reason: "Auto-merge is enabled in control state, but merge execution is not connected yet",
  });
}

    const latest = await readTasksFile();
    const latestTask = latest.tasks.find(
      (candidate) => candidate.id === task.id
    );

    if (latestTask) {
      latestTask.status = "pending-pr";
      latestTask.updatedAt = new Date().toISOString();
      latestTask.result = {
  branchName,
  pullRequestUrl: pr.html_url,
  pullRequestNumber: pr.number,
  merged: Boolean(mergeResult),
};
    }

    updateTaskStatus(task.id, "pending-pr");

    await writeTasksFile(
      latest.tasks,
      latest.sha,
      `Mark task ${task.id} as pending PR`
    );

    await logActivity({
      type: "pending-pr",
      runId,
      taskId: task.id,
      branch: branchName,
      pullRequestUrl: pr.html_url,
      reason: "Pull request created and task is waiting for review",
    });

    return NextResponse.json({
  ok: true,
  mode: mergeResult ? "pull-request-merged" : "pull-request-created",
  runId,
  taskId: task.id,
  branchName,
  pullRequestUrl: pr.html_url,
  validation: prValidation,
  mergeResult,
});
  } catch (error) {
    await logActivity({
      type: "failed",
      runId,
      reason: error instanceof Error ? error.message : "Unknown error",
      failureType: "runner-failed",
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        mode: "runner-failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      await releaseRunnerLock();
    }
  }
}