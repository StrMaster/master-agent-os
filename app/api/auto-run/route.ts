import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "../agent-runner/activity";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

const AUTO_RUN_COOLDOWN_MS = 2 * 60 * 1000;
const AUTO_RUN_MAX_ITERATIONS = 3;
const RUNTIME_STOP_FAILURE_THRESHOLD = 3;

let lastAutoRunAt: number | null = null;

function internalUrl(req: NextRequest, path: string) {
  return new URL(path, req.url);
}

async function internalJsonFetch(req: NextRequest, path: string, init?: RequestInit) {
  const res = await fetch(internalUrl(req, path), {
    ...init,
    headers: {
      cookie: req.headers.get("cookie") ?? "",
      ...(init?.headers ?? {}),
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

async function readTasks() {
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
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${TASKS_PATH}`);
  }

  const file = await res.json();

  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return JSON.parse(content);
}

async function mergePullRequest(prNumber: number) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

function dependenciesSatisfied(task: any, tasks: any[]) {
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
        candidate &&
        candidate.id === dependencyId &&
        (candidate.status === "done" || candidate.status === "pending-pr"),
    ),
  );
}

function previousWaveSatisfied(task: any, tasks: any[]) {
  if (!task.parentTaskId || !task.wave || task.wave <= 1) {
    return true;
  }

  const previousWave = tasks.find(
    (candidate) =>
      candidate &&
      candidate.parentTaskId === task.parentTaskId &&
      candidate.wave === task.wave - 1,
  );

  if (!previousWave) {
    return false;
  }

  return (
    previousWave.status === "done" || previousWave.status === "pending-pr"
  );
}

function isReadyForAutoRun(task: any, tasks: any[]) {
  if (!task || (task.status !== "todo" && task.status !== "queued")) {
    return false;
  }

  if (task.previewOnly || task.requiresApproval) {
    return false;
  }

  if (task.waveStatus === "blocked") {
    return false;
  }

  return dependenciesSatisfied(task, tasks) && previousWaveSatisfied(task, tasks);
}

function findReadyTask(tasks: any[], excludedTaskIds: Set<string> = new Set()) {
  return (
    tasks.find(
      (task) => isReadyForAutoRun(task, tasks) && !excludedTaskIds.has(task.id),
    ) ?? null
  );
}

function isAutoRunSuccessMode(mode?: string) {
  return (
    mode === "pull-request-created" ||
    mode === "pull-request-merged" ||
    mode === "existing-pr"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRunOnce = body?.forceRunOnce === true;
    const { data: stateData } = await internalJsonFetch(
  req,
  "/api/control-state"
);
    const state = stateData.state;

    if (!stateData.ok || !state) {
      return NextResponse.json({
        ok: false,
        mode: "control-state-error",
        error: stateData.error ?? "Failed to load control state",
      });
    }

    if (state.emergencyStop) {
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

    const runtimeBlockedUntilMs = state.runtimeBlockedUntil
      ? new Date(state.runtimeBlockedUntil).getTime()
      : 0;

    if (
      state.recoveryActive &&
      runtimeBlockedUntilMs > 0 &&
      runtimeBlockedUntilMs <= Date.now() &&
      (state.consecutiveFailures ?? 0) < RUNTIME_STOP_FAILURE_THRESHOLD
    ) {
      const nextAutoRunEnabled =
        state.recoveryAutoRunResumeEligible === true
          ? true
          : state.autoRunEnabled;

      const { data: resumeStateData } = await internalJsonFetch(
        req,
        "/api/control-state",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recoveryActive: false,
            recoveryAutoRunResumeEligible: false,
            runtimeBlockedUntil: null,
            autoRunEnabled: nextAutoRunEnabled,
          }),
        }
      );

      await logActivity({
        type: "recovery-mode-auto-resumed",
        reason: "Recovery mode cleared after runtime block expired and health improved.",
        runtimeBlockedUntil: state.runtimeBlockedUntil,
        consecutiveFailures: state.consecutiveFailures ?? 0,
        autoRunEnabled: resumeStateData?.state?.autoRunEnabled ?? nextAutoRunEnabled,
      }).catch(() => {});

      if (resumeStateData?.ok && resumeStateData.state) {
        Object.assign(state, resumeStateData.state);
      } else {
        state.recoveryActive = false;
        state.recoveryAutoRunResumeEligible = false;
        state.runtimeBlockedUntil = undefined;
        state.autoRunEnabled = nextAutoRunEnabled;
      }
    }

    if (state.recoveryActive) {
      return NextResponse.json({
        ok: false,
        mode: "recovery-active",
        message: "Recovery mode is active",
      });
    }

    if (state.runnerHealthStatus === "blocked") {
      return NextResponse.json({
        ok: false,
        mode: "runner-health-blocked",
        message: "Runner health is blocked",
      });
    }

    if (!forceRunOnce && runtimeBlockedUntilMs > Date.now()) {
      return NextResponse.json({
        ok: false,
        mode: "runtime-blocked",
        message: "Automatic execution is temporarily blocked after repeated runtime failures.",
        runtimeBlockedUntil: state.runtimeBlockedUntil,
        retryAfterMs: runtimeBlockedUntilMs - Date.now(),
      });
    }

    if (!state.autoRunEnabled && !forceRunOnce) {
      return NextResponse.json({
        ok: false,
        mode: "auto-run-disabled",
        message: "Auto-run is disabled",
      });
    }

    const tasks = await readTasks();

const pendingPrTask = Array.isArray(tasks)
  ? tasks.find(
      (task) =>
        task &&
        task.status === "pending-pr" &&
        task.result?.pullRequestNumber &&
        task.result?.merged !== true &&
        !task.error
    )
  : null;

if (false && state.autoMergeEnabled && pendingPrTask) {
  const mergeResult = await mergePullRequest(
    pendingPrTask.result.pullRequestNumber
  );

  return NextResponse.json({
    ok: mergeResult.ok,
    mode: mergeResult.ok ? "auto-merge" : "auto-merge-failed",
    task: pendingPrTask,
    merge: mergeResult,
  });
}

    const availableTask = Array.isArray(tasks)
      ? findReadyTask(tasks)
      : null;

    if (!availableTask) {
      return NextResponse.json({
        ok: true,
        mode: "no-work",
        message: "No runnable queued or todo tasks available",
      });
    }

    const now = Date.now();
      
if (
  !forceRunOnce &&
  lastAutoRunAt &&
  now - lastAutoRunAt < AUTO_RUN_COOLDOWN_MS
) {
      return NextResponse.json({
        ok: false,
        mode: "auto-run-cooldown",
        message: "Auto-run cooldown active",
        retryAfterMs: AUTO_RUN_COOLDOWN_MS - (now - lastAutoRunAt),
      });
    }

    lastAutoRunAt = now;

    const { res: deployRes, data: deployData } = await internalJsonFetch(
  req,
  "/api/deploy-status"
);

    if (!deployRes.ok || deployData.ok === false) {
      return NextResponse.json({
        ok: false,
        mode: "deploy-status-unavailable",
        message: "Deploy status unavailable. Auto-run blocked for safety.",
        error: deployData.error,
      });
    }

    const deployState = deployData.deployment?.state;

    if (deployState === "BUILDING" || deployState === "QUEUED") {
      return NextResponse.json({
        ok: false,
        mode: "deploy-in-progress",
        message: "Deploy is still in progress. Auto-run blocked.",
        deployment: deployData.deployment,
      });
    }

    if (deployData.deployFailed || deployState === "ERROR") {
      return NextResponse.json({
        ok: false,
        mode: "deploy-failed",
        message: "Latest deploy failed. Auto-run blocked.",
        deployment: deployData.deployment,
      });
    }

    let runnerData: any = null;
    let runnerRes: Response | null = null;
    let iterations = 0;
    const seenTaskIds = new Set<string>();

    while (iterations < AUTO_RUN_MAX_ITERATIONS) {
      const { res: nextRunnerRes, data: nextRunnerData } = await internalJsonFetch(
        req,
        "/api/agent-runner",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            forceRunOnce: true,
          }),
        },
      );

      runnerRes = nextRunnerRes;
      runnerData = nextRunnerData;
      iterations += 1;

      const processedTaskId = nextRunnerData?.taskId ?? nextRunnerData?.task?.id;

      if (processedTaskId && seenTaskIds.has(processedTaskId)) {
        await logActivity({
          type: "auto-run-loop-stopped",
          iterations,
          taskId: processedTaskId,
          reason: "Repeated task detected during auto-run continuation.",
        }).catch(() => {});
        break;
      }

      if (processedTaskId) {
        seenTaskIds.add(processedTaskId);
      }

      if (!nextRunnerRes.ok || nextRunnerData.ok === false) {
        await logActivity({
          type: "task-chain-stopped",
          iterations,
          taskId: processedTaskId,
          mode: nextRunnerData?.mode ?? "runner-failed",
          reason: "Runner returned a non-successful result.",
        }).catch(() => {});
        break;
      }

      if (!isAutoRunSuccessMode(nextRunnerData.mode)) {
        await logActivity({
          type: "task-chain-stopped",
          iterations,
          taskId: processedTaskId,
          mode: nextRunnerData.mode,
          reason: "Runner finished without a chain-safe completion mode.",
        }).catch(() => {});
        break;
      }

      const latestTasks = await readTasks();
      const nextReadyTask = findReadyTask(latestTasks, seenTaskIds);

      if (!nextReadyTask) {
        await logActivity({
          type: "task-chain-stopped",
          iterations,
          taskId: processedTaskId,
          mode: nextRunnerData.mode,
          reason: "No additional approved ready tasks were available.",
        }).catch(() => {});
        break;
      }

      await logActivity({
        type: "auto-run-continued",
        iterations,
        taskId: processedTaskId,
        mode: nextRunnerData.mode,
        nextTaskId: nextReadyTask.id,
      }).catch(() => {});
    }

    if (iterations >= AUTO_RUN_MAX_ITERATIONS) {
      await logActivity({
        type: "task-chain-stopped",
        iterations,
        taskId: runnerData?.taskId ?? runnerData?.task?.id ?? availableTask.id,
        mode: runnerData?.mode,
        reason: "Auto-run continuation iteration cap reached.",
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: runnerRes?.ok && runnerData?.ok !== false,
      mode: "auto-run",
      iterations,
      task: availableTask,
      runner: runnerData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "auto-run-failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
