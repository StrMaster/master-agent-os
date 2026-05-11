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
import { evaluateStopConditions } from "@/app/lib/stop-conditions";
import { reviewUiIntentPatch } from "@/agents/core/agent-review-rules";
import { logActivity, readActivityFile } from "./activity";
import { readGithubJson, writeGithubJson } from "./github";
import {
  incrementStateCounter,
  readStateFile,
  releaseRunnerLock,
  resetRuntimeFailureCounters,
  updateStateWith,
  writeStateFile,
} from "./state";
import type { AgentState, AgentTask, GitHubFile, Priority } from "./types";



export const runtime = "nodejs";

// CONFIG
const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

const TASKS_PATH = ".agent/tasks.json";
const PROJECT_STATE_PATH = ".agent/PROJECT_STATE.md";

const RUNNER_COOLDOWN_MS = 3_000;
const RUNNER_STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_TASK_RETRIES = 3;
const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_EXECUTION_SPACING_MS = 15 * 1000;

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/components/ActivityFeed.tsx",
  "app/components/RunAgentButton.tsx",
  "app/execution/page.tsx",
];

let lastExecutionAt = 0;

// GITHUB JSON HELPERS
async function readProjectState() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return "";
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PROJECT_STATE_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return "";
  }

  const file = await res.json();
  return Buffer.from(file.content, "base64").toString("utf-8");
}

// TASK HELPERS
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

async function createRecoveryTask({
  failedTask,
  reason,
}: {
  failedTask: AgentTask;
  reason: string;
}) {
  const { tasks, sha } = await readTasksFile();

  const existingRecoveryTask = tasks.find(
    (task) =>
      task.recoveryOfTaskId === failedTask.id &&
      ["todo", "running", "pending-pr"].includes(task.status)
  );

  if (existingRecoveryTask) {
    await logActivity({
      type: "recovery-task-duplicate-blocked",
      runId: existingRecoveryTask.id,
      taskId: failedTask.id,
      agentName: "Senior Recovery Agent",
      reason,
    });

    return existingRecoveryTask;
  }

  const recoveryTask: AgentTask = {
    id: `recovery-${Date.now()}`,
    title: `Recovery: ${failedTask.title}`,
    summary: `Recover failed task: ${failedTask.id}`,
    targetFile: failedTask.targetFile,
    status: "todo",
    priority: "high",
    createdAt: new Date().toISOString(),

    agentRole: "senior-recovery",
    agentName: "Senior Recovery Agent",

    recoveryOfTaskId: failedTask.id,
    recoveryReason: reason,

    plannerNotes:
      "Automatically generated recovery task after reviewer/execution failure.",
  };

  tasks.unshift(recoveryTask);

  await writeTasksFile(
  tasks,
  sha,
  `Create recovery task for ${failedTask.id}`
);

  await logActivity({
    type: "recovery-task-created",
    runId: recoveryTask.id,
    taskId: failedTask.id,
    agentName: "Senior Recovery Agent",
    reason,
  });

  return recoveryTask;
}

// RUNNER SAFETY
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

// TASK SELECTION
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

function previousWaveCompleted(task: AgentTask, tasks: AgentTask[]) {
  if (!task.parentTaskId || !task.wave || task.wave <= 1) {
    return true;
  }

  const previousWave = tasks.find(
    (candidate) =>
      candidate.parentTaskId === task.parentTaskId &&
      candidate.wave === task.wave! - 1
  );

  if (!previousWave) {
    return false;
  }

  return (
    previousWave.status === "done" ||
    previousWave.status === "pending-pr"
  );
}

// PATCH REVIEW
function reviewGeneratedPatch(currentContent: string, patchedContent: string) {
  const currentLength = currentContent.trim().length;
  const patchedLength = patchedContent.trim().length;

  if (patchedLength < 20) {
    return {
      valid: false,
      reason: "Generated patch is too short",
    };
  }

  if (currentLength > 200 && patchedLength < currentLength * 0.35) {
    return {
      valid: false,
      reason: "Generated patch appears to delete too much existing code",
    };
  }

  if (currentLength > 200 && patchedLength > currentLength * 2.5) {
    return {
      valid: false,
      reason: "Generated patch is much larger than the original file",
    };
  }

  return {
    valid: true,
  };
}

function retryAllowed(task: AgentTask) {
  const retryCount = task.retryCount ?? 0;

  if (retryCount >= MAX_TASK_RETRIES) {
    return false;
  }

  if (!task.lastRetryAt) {
    return true;
  }

  const lastRetry = new Date(task.lastRetryAt).getTime();

  return Date.now() - lastRetry >= RETRY_COOLDOWN_MS;
}

function selectNextTask(tasks: AgentTask[], activity: any[]) {
  const candidates = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === "todo")
    .filter(({ task }) => dependenciesCompleted(task, tasks))
    .filter(({ task }) => previousWaveCompleted(task, tasks))
    .filter(({ task }) => retryAllowed(task))
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

// ROUTE HANDLERS
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

const now = Date.now();

if (now - lastExecutionAt < MIN_EXECUTION_SPACING_MS) {
  return NextResponse.json({
    ok: false,
    mode: "execution-spacing-active",
    message: "Execution pacing protection active",
    retryAfterMs:
      MIN_EXECUTION_SPACING_MS - (now - lastExecutionAt),
  });
}

lastExecutionAt = now;

  const runId = crypto.randomUUID();
let lockAcquired = false;
let activeTask: AgentTask | null = null;

try {
    const { state, sha: stateSha } = await readStateFile();
    const now = Date.now();
    
    const stopCheck = evaluateStopConditions({
  emergencyStop: state.emergencyStop,
  paused: state.paused,
  recentFailedRuns: state.recentFailedRuns,
  recentValidationFailures: state.recentValidationFailures,
  recentMergeFailures: state.recentMergeFailures,
  recentDeployFailures: state.recentDeployFailures,
  recoveryActive: state.recoveryActive,
});

if (stopCheck.stop) {
  const recoveryCodes = [
    "too-many-failed-runs",
    "too-many-validation-failures",
    "too-many-merge-failures",
    "deploy-failure-threshold",
  ];

  if (stopCheck.code && recoveryCodes.includes(stopCheck.code)) {
    await updateStateWith(
      (currentState) => ({
        ...currentState,
        recoveryActive: true,
        autoRunEnabled: false,
        autoMergeEnabled: false,
      }),
      "Enable recovery mode after stop condition"
    ).catch(() => {});

    await logActivity({
      type: "recovery-mode-enabled",
      runId,
      reason: stopCheck.reason ?? "Recovery mode enabled by stop condition",
      stopCode: stopCheck.code,
    }).catch(() => {});
  }

  await logActivity({
    type: stopCheck.code ?? "runner-stopped",
    runId,
    reason: stopCheck.reason ?? "Runner stopped by safety condition",
  }).catch(() => {});

  return NextResponse.json({
    ok: false,
    mode: stopCheck.code ?? "runner-stopped",
    message: stopCheck.reason ?? "Runner stopped by safety condition",
    recoveryActive: stopCheck.code
      ? recoveryCodes.includes(stopCheck.code)
      : false,
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
    activeTask = task;

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
  intent: task.intent,
  riskLevel: task.riskLevel,
  executionMode: task.executionMode,
  wave: task.wave,
  parentTaskId: task.parentTaskId,
  plannerNotes: task.plannerNotes,
  agentName: task.agentName,
agentRole: task.agentRole,
});

    if (task.executionMode === "multi-step" && task.riskLevel === "high") {
  await logActivity({
    type: "planner-required",
    runId,
    taskId: task.id,
    summary: task.title,
    targetFile: task.targetFile,
    riskLevel: task.riskLevel,
    executionMode: task.executionMode,
    wave: task.wave,
    reason:
      "High-risk multi-step task blocked from direct execution. Planner waves required.",
  });

  task.retryCount = (task.retryCount ?? 0) + 1;
task.lastRetryAt = new Date().toISOString();

  updateTaskStatus(task.id, "failed");

try {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const plannerRes = await fetch(`${baseUrl}/api/planner-waves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId: task.id,
    }),
  });

  const plannerData = await plannerRes.json();

  await logActivity({
    type: plannerRes.ok ? "planner-waves-auto-triggered" : "planner-waves-auto-failed",
    runId,
    taskId: task.id,
    reason: plannerRes.ok
      ? "Planner waves were automatically triggered"
      : "Planner waves auto-trigger failed",
    details: JSON.stringify(plannerData),
  });
} catch (error) {
  await logActivity({
    type: "planner-waves-auto-failed",
    runId,
    taskId: task.id,
    reason: "Planner waves auto-trigger failed",
    details: error instanceof Error ? error.message : "Unknown error",
  });
}

  return NextResponse.json({
    ok: false,
    mode: "planner-required",
    taskId: task.id,
    message:
      "High-risk multi-step task requires planner waves before execution.",
  });
}

    const currentContent = await readTargetFile(task.targetFile);

    const projectState = await readProjectState();

    const patchedContent = await generateCodePatch({
      filePath: task.targetFile,
      currentContent,
      taskTitle: task.title,
      taskSummary: task.summary ?? task.title,
      projectState,
      agentSystemPrompt: task.agentSystemPrompt,
agentName: task.agentName,
agentRole: task.agentRole,
routingReason: task.routingReason,
    });

const reviewerResult = reviewUiIntentPatch({
  prompt: `${task.title}\n${task.summary ?? ""}`,
  patchedContent,
});

if (!reviewerResult.passed) {
  await logActivity({
  type: "reviewer-agent-blocked",
  runId,
  taskId: task.id,
  reason:
    reviewerResult.reason ??
    "Reviewer Agent blocked unsafe UI implementation.",
  agentName: task.agentName,
agentRole: task.agentRole,
});

await createRecoveryTask({
  failedTask: task,
  reason:
    reviewerResult.reason ??
    "Reviewer Agent blocked unsafe patch.",
});

  return NextResponse.json({
    ok: false,
    mode: "reviewer-agent-blocked",
    reason: reviewerResult.reason,
  });
}

    const review = reviewGeneratedPatch(currentContent, patchedContent);
    
if (!review.valid) {
  const latest = await readTasksFile();
  const latestTask = latest.tasks.find(
    (candidate) => candidate.id === task.id
  );

  if (latestTask) {
    latestTask.status = "failed";
    latestTask.updatedAt = new Date().toISOString();
    latestTask.error = `Review failed: ${review.reason}`;
  }

  updateTaskStatus(task.id, "failed");

  await writeTasksFile(
    latest.tasks,
    latest.sha,
    `Mark task ${task.id} as failed after review`
  );

  await logActivity({
    type: "review-blocked",
    runId,
    taskId: task.id,
    reason: review.reason ?? "Generated patch blocked by review",
    failureType: "review-blocked",
  });

  await incrementStateCounter(
    "recentValidationFailures",
    "Track review intelligence failure"
  );

  return NextResponse.json(
    {
      ok: false,
      mode: "review-blocked",
      review,
    },
    { status: 400 }
  );
}

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

      await incrementStateCounter(
  "recentValidationFailures",
  "Track patch validation failure"
);

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

Target file: ${task.targetFile}

Intent: ${task.intent ?? "unknown"}
Risk level: ${task.riskLevel ?? "unknown"}
Execution mode: ${task.executionMode ?? "single-file"}
Wave: ${task.wave ?? 1}
Parent task: ${task.parentTaskId ?? "none"}
Planner notes: ${task.plannerNotes ?? "No planner notes"}

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
      agentName: task.agentName,
agentRole: task.agentRole,
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
          await incrementStateCounter(
  "recentValidationFailures",
  "Track pull request validation failure"
);
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
        agentName: task.agentName,
agentRole: task.agentRole,
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
      await incrementStateCounter(
  "recentMergeFailures",
  "Track pull request merge failure"
);
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

    await resetRuntimeFailureCounters(
  "Reset runtime failure counters after successful PR flow"
).catch(() => {});

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

    await incrementStateCounter(
  "recentFailedRuns",
  "Track failed agent runner execution"
).catch(() => {});

if (activeTask) {
  await createRecoveryTask({
    failedTask: activeTask,
    reason:
      error instanceof Error
        ? error.message
        : "Unknown execution failure",
  });
}

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
