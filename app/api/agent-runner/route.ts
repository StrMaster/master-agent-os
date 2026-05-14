import { NextResponse } from "next/server";
import { readRepoContext, getActiveFileHints } from "@/agents/core/repo-context";
import { generateCodePatch, generateMultiFilePatch } from "@/app/lib/code-patch-generator";
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
import {
  incrementStateCounter,
  readStateFile,
  releaseRunnerLock,
  resetRuntimeFailureCounters,
  summarizeRunnerHealth,
  trackRuntimeFailure,
  updateStateWith,
  writeStateFile,
} from "./state";
import {
  recordRuntimeExecutionSummary,
  recordRuntimeFailureMemory,
} from "./memory";
import { createRecoveryTask, readTasksFile, writeTasksFile } from "./tasks";
import type {
  AgentTask,
  GitHubFile,
  Priority,
  RunnerHealthStatus,
} from "./types";
import { addCoordinationEvent } from "@/app/lib/coordination-memory";



// Flow: task -> validation -> branch -> PR -> optional merge -> recovery
export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

const PROJECT_STATE_PATH = ".agent/PROJECT_STATE.md";

const RUNNER_COOLDOWN_MS = 3_000;
const RUNNER_STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_TASK_RETRIES = 3;
const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_EXECUTION_SPACING_MS = 15 * 1000;
const RUNTIME_STOP_FAILURE_THRESHOLD = 3;
const RUNTIME_STOP_BLOCK_MS = 15 * 60 * 1000;

const SAFE_TARGET_FILES = [
  "app/page.tsx",
  "app/components/ActivityFeed.tsx",
  "app/components/RunAgentButton.tsx",
  "app/execution/page.tsx",
];

const RUNNABLE_TASK_STATUSES = ["todo", "queued"] as const;

function isRunnableTaskStatus(status: AgentTask["status"]) {
  return RUNNABLE_TASK_STATUSES.includes(
    status as (typeof RUNNABLE_TASK_STATUSES)[number]
  );
}

let lastExecutionAt = 0;

async function internalJsonFetch(req: Request, path: string) {
  const res = await fetch(new URL(path, req.url), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "",
      "x-vercel-set-bypass-cookie": "samesitenone",
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `${path} returned non-JSON response: ${res.status} ${text.slice(0, 80)}`
    );
  }

  return {
    res,
    data: await res.json(),
  };
}

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

async function readTargetFiles(paths: string[]): Promise<Array<{ filePath: string; currentContent: string }>> {
  return Promise.all(
    paths.map(async (filePath) => ({
      filePath,
      currentContent: await readTargetFile(filePath),
    }))
  );
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
  const dependencyIds = [
    ...(task.dependsOn ?? []),
    ...(task.dependsOnTaskIds ?? []),
    ...(task.blockedBy ?? []),
  ];

  if (!dependencyIds.length) {
    return true;
  }

  return dependencyIds.every((dependencyId) =>
    tasks.some(
      (candidate) =>
        candidate.id === dependencyId &&
        (candidate.status === "done" || candidate.status === "pending-pr")
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

function isRecoveryTask(task: AgentTask) {
  return task.agentRole === "senior-recovery" || Boolean(task.recoveryOfTaskId);
}

function isSafeRuntimeBlock(runtimeBlockedUntil?: string) {
  if (!runtimeBlockedUntil) {
    return true;
  }

  return new Date(runtimeBlockedUntil).getTime() <= Date.now();
}

function finalizeRecoverySuccess(
  latestTasks: AgentTask[],
  task: AgentTask,
  completedAt: string,
  result: {
    branchName: string;
    pullRequestUrl: string;
    pullRequestNumber?: number;
    merged: boolean;
  }
) {
  if (!isRecoveryTask(task) || !task.recoveryOfTaskId) {
    return null;
  }

  const originalFailedTask = latestTasks.find(
    (candidate) => candidate.id === task.recoveryOfTaskId
  );

  if (!originalFailedTask) {
    return null;
  }

  originalFailedTask.status = "pending-pr";
  originalFailedTask.completedAt = completedAt;
  originalFailedTask.updatedAt = completedAt;
  originalFailedTask.error = undefined;
  originalFailedTask.result = result;

  updateTaskStatus(originalFailedTask.id, "pending-pr");

  return originalFailedTask;
}

function buildExecutionContext(
  task: AgentTask,
  tasks: AgentTask[]
) {
  if (!isRecoveryTask(task)) {
    return {
      taskTitle: task.title,
      taskSummary: task.summary ?? task.title,
    };
  }

  const originalFailedTask = task.recoveryOfTaskId
    ? tasks.find((candidate) => candidate.id === task.recoveryOfTaskId)
    : null;

  const recoverySummaryParts = [
    task.summary ?? task.title,
    task.recoveryOfTaskId
      ? `Recovery task for: ${task.recoveryOfTaskId}`
      : null,
    task.recoveryReason
      ? `Recovery reason: ${task.recoveryReason}`
      : null,
    originalFailedTask?.title
      ? `Original failed task title: ${originalFailedTask.title}`
      : null,
    originalFailedTask?.summary
      ? `Original failed task summary: ${originalFailedTask.summary}`
      : null,
  ].filter(Boolean);

  return {
    taskTitle: task.title,
    taskSummary: recoverySummaryParts.join("\n"),
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
    // Ready gate: approval, waves, and dependency state must be clear before selection.
    .filter(({ task }) => isRunnableTaskStatus(task.status))
    .filter(({ task }) => !task.previewOnly && !task.requiresApproval)
    .filter(({ task }) => task.waveStatus !== "blocked")
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

async function syncRunnerHealth(
  state: {
    consecutiveFailures?: number;
    runtimeBlockedUntil?: string;
    runnerLocked?: boolean;
    runnerHealthStatus?: RunnerHealthStatus;
  },
  {
    runId,
    taskId,
  }: {
    runId: string;
    taskId?: string;
  }
) {
  const nextHealth = summarizeRunnerHealth(state);
  const previousHealth = state.runnerHealthStatus ?? "healthy";

  if (nextHealth === previousHealth) {
    return;
  }

  await updateStateWith(
    (currentState) => ({
      ...currentState,
      runnerHealthStatus: nextHealth,
    }),
    `Update runner health to ${nextHealth}`
  );

  if (nextHealth === "healthy" && previousHealth !== "healthy") {
    await logActivity({
      type: "runner-health-recovered",
      runId,
      taskId,
      previousHealth,
      runnerHealth: nextHealth,
    });
    return;
  }

  if (nextHealth !== "healthy") {
    await logActivity({
      type: "runner-health-degraded",
      runId,
      taskId,
      previousHealth,
      runnerHealth: nextHealth,
    });
  }
}

export async function GET() {
  try {
    const { tasks } = await readTasksFile();

    return NextResponse.json({
      ok: true,
      totalTasks: tasks.length,
      todoCount: tasks.filter((task) =>
  isRunnableTaskStatus(task.status)).length,
      runningCount: tasks.filter((task) => task.status === "running").length,
      pendingPrCount: tasks.filter((task) => task.status === "pending-pr")
        .length,
      doneCount: tasks.filter((task) => task.status === "done").length,
      failedCount: tasks.filter((task) => task.status === "failed").length,
      nextTodoTask: tasks.find((task) => isRunnableTaskStatus(task.status)) ?? null,
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const forceRunOnce = body?.forceRunOnce === true;

  const now = Date.now();

if (!forceRunOnce && now - lastExecutionAt < MIN_EXECUTION_SPACING_MS) {
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
    await syncRunnerHealth(state, { runId }).catch(() => {});
    
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
        recoveryAutoRunResumeEligible:
          currentState.autoRunEnabled === true,
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
        message: "No runnable queued or todo tasks",
      });
    }

    const task = selected.task;
    const taskIndex = selected.index;
    activeTask = task;

        if (task.result?.pullRequestUrl) {
      task.status = "pending-pr";
      task.updatedAt = new Date().toISOString();
      task.completedAt = task.completedAt ?? new Date().toISOString();
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

      await updateTaskStatus(task.id, "pending-pr");

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
    task.startedAt = task.startedAt ?? new Date().toISOString();
    task.completedAt = undefined;
    task.updatedAt = new Date().toISOString();
    tasks[taskIndex] = task;

    await updateTaskStatus(task.id, "running");

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

  task.status = "planner-required";
task.updatedAt = new Date().toISOString();
task.completedAt = undefined;
tasks[taskIndex] = task;

await updateTaskStatus(task.id, "planner-required");

await writeTasksFile(
  tasks,
  sha,
  `Mark task ${task.id} as planner required`
);

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
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "",
      "x-vercel-set-bypass-cookie": "samesitenone",
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

    const isMultiFile = Array.isArray(task.targetFiles) && task.targetFiles.length > 1;

    const currentContent = await readTargetFile(task.targetFile);

    if (isMultiFile) {
      const files = await readTargetFiles(task.targetFiles!);
      const repoContext = await readRepoContext().catch(() => null);
      const repoContextSummary = repoContext
        ? [
            `Frontend files: ${(repoContext.frontendFiles ?? []).join(", ")}`,
            `Backend files: ${(repoContext.backendFiles ?? []).join(", ")}`,
            `Legacy zones (do not touch): ${(repoContext.legacyZones ?? []).join(", ")}`,
          ].filter(Boolean).join("\n")
        : undefined;

      const patches = await generateMultiFilePatch({
        files,
        taskTitle: task.title,
        taskSummary: task.summary ?? "",
        projectState: await readProjectState(),
        repoContext: repoContextSummary,
        agentSystemPrompt: task.agentSystemPrompt,
        agentName: task.agentName,
        agentRole: task.agentRole,
        routingReason: task.routingReason,
      });

      const branchName = `agent-task-${task.id}`;
      await createBranch(branchName);

      for (const patch of patches) {
        await updateFileOnBranch(branchName, patch.filePath, patch.patchedContent);
      }

      const pr = await createPullRequest({
        branch: branchName,
        title: task.title,
        body: `Multi-file task: ${task.summary ?? task.title}\n\nFiles changed:\n${patches.map(p => `- ${p.filePath}`).join("\n")}`,
      });

      task.status = "pending-pr";
      task.result = {
        branchName,
        pullRequestUrl: pr.html_url,
        pullRequestNumber: pr.number,
      };
      task.updatedAt = new Date().toISOString();
      tasks[taskIndex] = task;
      await updateTaskStatus(task.id, "pending-pr");
      await writeTasksFile(tasks, sha, `Multi-file PR for task ${task.id}`);

      await addCoordinationEvent({
        timestamp: Date.now(),
        agent: task.agentName ?? "senior-execution",
        type: "pull-request-created",
        summary: `Multi-file PR created for task: ${task.title}`,
        taskId: task.id,
        targetFile: task.targetFiles!.join(", "),
      }).catch(() => {});

      return NextResponse.json({
        ok: true,
        mode: "multi-file-pr-created",
        taskId: task.id,
        pullRequestUrl: pr.html_url,
        filesChanged: patches.map(p => p.filePath),
      });
    }

    const projectState = await readProjectState();
    const repoContext = await readRepoContext().catch(() => null);
    const executionContext = buildExecutionContext(task, tasks);

    const repoContextSummary = repoContext
      ? [
          `Frontend files: ${(repoContext.frontendFiles ?? []).join(", ")}`,
          `Backend files: ${(repoContext.backendFiles ?? []).join(", ")}`,
          `Orchestration files: ${(repoContext.orchestrationFiles ?? []).join(", ")}`,
          `Legacy zones (do not touch): ${(repoContext.legacyZones ?? []).join(", ")}`,
          repoContext.riskyFiles?.length
            ? `Risky files (extra caution): ${repoContext.riskyFiles.map(f => `${f.targetFile} (${f.hits} hits)`).join(", ")}`
            : "",
        ].filter(Boolean).join("\n")
      : undefined;

    const patchedContent = await generateCodePatch({
      filePath: task.targetFile,
      currentContent,
      taskTitle: executionContext.taskTitle,
      taskSummary: executionContext.taskSummary,
      projectState,
      repoContext: repoContextSummary,
      agentSystemPrompt: task.agentSystemPrompt,
agentName: task.agentName,
agentRole: task.agentRole,
routingReason: task.routingReason,
    });

const reviewerResult = reviewUiIntentPatch({
  prompt: `${task.title}\n${task.summary ?? ""}\n${task.targetFile ?? ""}`,
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

  await addCoordinationEvent({
  timestamp: Date.now(),
  agent: task.agentName ?? "senior-execution",
  type: "reviewer-blocked",
  summary: `Reviewer blocked task: ${reviewerResult.reason ?? "unknown reason"}`,
  taskId: task.id,
  targetFile: task.targetFile,
}).catch(() => {});

await createRecoveryTask({
  failedTask: task,
  reason:
    reviewerResult.reason ??
    "Reviewer Agent blocked unsafe patch.",
});

      await recordRuntimeFailureMemory({
        taskId: task.id,
        title: task.title,
        targetFile: task.targetFile,
        reason: reviewerResult.reason ?? "Reviewer Agent blocked unsafe patch.",
      }).catch(() => {});

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
    latestTask.completedAt = new Date().toISOString();
    latestTask.updatedAt = new Date().toISOString();
    latestTask.error = `Review failed: ${review.reason}`;
  }

  await updateTaskStatus(task.id, "failed");

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

  await recordRuntimeFailureMemory({
    taskId: task.id,
    title: task.title,
    targetFile: task.targetFile,
    reason: review.reason ?? "Generated patch blocked by review",
  }).catch(() => {});

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
        latestTask.completedAt = new Date().toISOString();
        latestTask.updatedAt = new Date().toISOString();
        latestTask.error = `Patch validation failed: ${validation.issues.join(
          ", "
        )}`;
      }

      await updateTaskStatus(task.id, "failed");

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

      await recordRuntimeFailureMemory({
        taskId: task.id,
        title: task.title,
        targetFile: task.targetFile,
        reason: validation.issues.join(", "),
      }).catch(() => {});

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
        latestTask.completedAt = new Date().toISOString();
        latestTask.updatedAt = new Date().toISOString();
        latestTask.result = {
          branchName,
          pullRequestUrl: existingPr.html_url,
          pullRequestNumber: existingPr.number,
          merged: false,
        };
      }

      await updateTaskStatus(task.id, "pending-pr");
      finalizeRecoverySuccess(
        latest.tasks,
        task,
        new Date().toISOString(),
        {
          branchName,
          pullRequestUrl: existingPr.html_url,
          pullRequestNumber: existingPr.number,
          merged: false,
        }
      );

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

      if (isRecoveryTask(task)) {
        await logActivity({
          type: "recovery-retry-completed",
          runId,
          taskId: task.id,
          reason: "Recovery task completed against an existing pull request.",
          details: JSON.stringify({
            recoveryOfTaskId: task.recoveryOfTaskId,
            pullRequestUrl: existingPr.html_url,
          }),
        });
      }

      await recordRuntimeExecutionSummary({
        taskId: task.id,
        title: task.title,
        targetFile: task.targetFile,
        status: "existing-pr",
        branchName,
        pullRequestUrl: existingPr.html_url,
        completedAt: new Date().toISOString(),
      }).catch(() => {});

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

  await addCoordinationEvent({
  timestamp: Date.now(),
  agent: task.agentName ?? "senior-execution",
  type: "pull-request-created",
  summary: `PR created for task: ${task.title}`,
  taskId: task.id,
  targetFile: task.targetFile,
}).catch(() => {});

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
    const { data: mergeStateData } = await internalJsonFetch(req, "/api/control-state").catch(() => ({
      data: null,
    }));
    const mergeState = mergeStateData?.state ?? state;
    const taskWasApproved =
      Boolean(task.approvedAt || task.approvedBy) ||
      (!task.previewOnly && !task.requiresApproval);
    const deploySafe = mergeState.deployStatus !== "failed" && !mergeState.deployError;
    const runtimeSafe =
      isSafeRuntimeBlock(mergeState.runtimeBlockedUntil) &&
      mergeState.recoveryActive !== true &&
      mergeState.runnerHealthStatus !== "blocked";

if (mergeState.autoMergeEnabled && typeof pr.number === "number") {
  const canAutoMerge =
    prValidation &&
    taskWasApproved &&
    prValidation.mergeable === true &&
    prValidation.draft !== true &&
    prValidation.merged !== true &&
    prValidation.state === "open" &&
    deploySafe &&
    runtimeSafe &&
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
        autoMergeEnabled: mergeState.autoMergeEnabled,
        hasValidation: Boolean(prValidation),
        mergeable: prValidation?.mergeable,
        draft: prValidation?.draft,
        merged: prValidation?.merged,
        state: prValidation?.state,
        deployStatus: mergeState.deployStatus,
        deployError: mergeState.deployError,
        runtimeBlockedUntil: mergeState.runtimeBlockedUntil,
        recoveryActive: mergeState.recoveryActive,
        runnerHealthStatus: mergeState.runnerHealthStatus,
        taskWasApproved,
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
      latestTask.completedAt = new Date().toISOString();
      latestTask.updatedAt = new Date().toISOString();
      latestTask.result = {
  branchName,
  pullRequestUrl: pr.html_url,
  pullRequestNumber: pr.number,
        merged: Boolean(mergeResult),
      };
    }

    const recoveryCompletedTask = finalizeRecoverySuccess(
      latest.tasks,
      task,
      new Date().toISOString(),
      {
        branchName,
        pullRequestUrl: pr.html_url,
        pullRequestNumber: pr.number,
        merged: Boolean(mergeResult),
      }
    );

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

    await recordRuntimeExecutionSummary({
      taskId: task.id,
      title: task.title,
      targetFile: task.targetFile,
      status: mergeResult ? "pull-request-merged" : "pull-request-created",
      branchName,
      pullRequestUrl: pr.html_url,
      completedAt: new Date().toISOString(),
    }).catch(() => {});

    if (recoveryCompletedTask) {
      await logActivity({
        type: "recovery-retry-completed",
        runId,
        taskId: task.id,
        reason: "Recovery task completed successfully.",
        details: JSON.stringify({
          recoveryOfTaskId: task.recoveryOfTaskId,
          pullRequestUrl: pr.html_url,
        }),
      });
    }

    await internalJsonFetch(req, "/api/deploy-status").catch(() => null);

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
    await trackRuntimeFailure(
  "Track runtime failure metadata"
).catch(() => {});
    if (activeTask) {
      const failedTaskId = activeTask.id;
      await recordRuntimeFailureMemory({
        taskId: failedTaskId,
        title: activeTask.title,
        targetFile: activeTask.targetFile,
        reason: error instanceof Error ? error.message : "Unknown execution failure",
        runId,
      }).catch(() => {});
      await recordRuntimeExecutionSummary({
        taskId: failedTaskId,
        title: activeTask.title,
        targetFile: activeTask.targetFile,
        status: "runner-failed",
        completedAt: new Date().toISOString(),
      }).catch(() => {});
      const latest = await readTasksFile().catch(() => null);
      const latestTask = latest?.tasks.find(
        (candidate) => candidate.id === failedTaskId
      );

      if (latest && latestTask) {
        const failedAt = new Date().toISOString();

        latestTask.status = "failed";
        latestTask.completedAt = failedAt;
        latestTask.updatedAt = failedAt;
        latestTask.error =
          error instanceof Error ? error.message : "Unknown execution failure";

        updateTaskStatus(failedTaskId, "failed");

        await writeTasksFile(
          latest.tasks,
          latest.sha,
          `Mark task ${failedTaskId} as failed after execution failure`
        ).catch(() => {});
      }
    }

    const { state: latestState } = await readStateFile().catch(() => ({
      state: null,
      sha: "",
    }));
    const runtimeBlockedUntilTime = latestState?.runtimeBlockedUntil
      ? new Date(latestState.runtimeBlockedUntil).getTime()
      : 0;
    const recoveryRetryBlocked =
      !latestState ||
      latestState.recoveryActive === true ||
      latestState.runnerHealthStatus === "blocked" ||
      runtimeBlockedUntilTime > Date.now() ||
      (latestState.consecutiveFailures ?? 0) >= RUNTIME_STOP_FAILURE_THRESHOLD;

    if (
      latestState &&
      (latestState.consecutiveFailures ?? 0) >= RUNTIME_STOP_FAILURE_THRESHOLD
    ) {
      const blockedUntilTime = latestState.runtimeBlockedUntil
        ? new Date(latestState.runtimeBlockedUntil).getTime()
        : 0;
      const hasActiveRuntimeBlock = blockedUntilTime > Date.now();

      if (!hasActiveRuntimeBlock) {
        const runtimeBlockedUntil = new Date(
          Date.now() + RUNTIME_STOP_BLOCK_MS
        ).toISOString();

        await updateStateWith(
          (currentState) => ({
            ...currentState,
            runtimeBlockedUntil,
          }),
          "Set temporary runtime block after repeated failures"
        ).catch(() => {});

        await logActivity({
          type: "runtime-stop-triggered",
          runId,
          taskId: activeTask?.id,
          reason:
            "Temporary automatic execution block enabled after repeated runtime failures.",
          runtimeBlockedUntil,
          consecutiveFailures: latestState.consecutiveFailures,
        }).catch(() => {});
      }
    }

    if (activeTask) {
      if (recoveryRetryBlocked) {
        await logActivity({
          type: "recovery-retry-blocked",
          runId,
          taskId: activeTask.id,
          agentName: activeTask.agentName,
          reason:
            error instanceof Error ? error.message : "Unknown execution failure",
          details: JSON.stringify({
            recoveryActive: latestState?.recoveryActive ?? false,
            runnerHealthStatus: latestState?.runnerHealthStatus ?? "healthy",
            runtimeBlockedUntil: latestState?.runtimeBlockedUntil ?? null,
            consecutiveFailures: latestState?.consecutiveFailures ?? 0,
          }),
        }).catch(() => {});
      } else {
        await createRecoveryTask({
          failedTask: activeTask,
          reason:
            error instanceof Error
              ? error.message
              : "Unknown execution failure",
        });
      }
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
    const { state: finalState } = await readStateFile().catch(() => ({
  state: null,
  sha: "",
}));

if (finalState) {
  await syncRunnerHealth(finalState, {
    runId,
    taskId: activeTask?.id,
  }).catch(() => {});
}
  }
}
