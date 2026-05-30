import type { AgentState, RunnerHealthStatus } from "./types";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const STATE_PATH = ".agent/state.json";

type GitHubFile = {
  sha: string;
  content: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __MASTER_AGENT_RUNTIME_STATE__: AgentState | undefined;
}

function getRuntimeStateStore() {
  if (!globalThis.__MASTER_AGENT_RUNTIME_STATE__) {
    globalThis.__MASTER_AGENT_RUNTIME_STATE__ = {};
  }

  return globalThis.__MASTER_AGENT_RUNTIME_STATE__;
}

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

export async function readStateFile() {
  const runtimeState = getRuntimeStateStore();

  try {
    const { json, sha } = await readGithubJson(STATE_PATH);

    return {
      state: {
        ...((json || {}) as AgentState),
        ...runtimeState,
      },
      sha,
    };
  } catch {
    return {
      state: runtimeState,
      sha: "runtime-only",
    };
  }
}

export async function writeStateFile(
  state: AgentState,
  _sha: string,
  _message: string
) {
  globalThis.__MASTER_AGENT_RUNTIME_STATE__ = {
    ...getRuntimeStateStore(),
    ...state,
  };
}

export async function updateStateWith(
  mutator: (state: AgentState) => AgentState,
  message: string
) {
  const { state, sha } = await readStateFile();
  await writeStateFile(mutator(state), sha, message);
}

export type ControlStateSnapshot = {
  paused: boolean;
  runnerLocked: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  autoRunEnabled: boolean;
  autoMergeEnabled: boolean;
  emergencyStop: boolean;
  recentFailedRuns: number;
  recentValidationFailures: number;
  recentMergeFailures: number;
  recentDeployFailures: number;
  failedRuns: number;
  lastFailureAt?: string;
  consecutiveFailures: number;
  runtimeBlockedUntil?: string;
  runnerHealthStatus: RunnerHealthStatus;
  recoveryAutoRunResumeEligible: boolean;
  recoveryActive: boolean;
  deployStatus?: AgentState["deployStatus"];
  deployStartedAt?: string;
  deployCompletedAt?: string;
  deployError?: string;
  lastDeployUrl?: string;
  overnightModeActive: boolean;
  overnightSessionStartedAt?: string;
  overnightSessionCompletedAt?: string;
  overnightSessionStopReason?: string;
  overnightTasksCompleted: number;
  overnightPrsCreated: number;
  overnightFailures: number;
  overnightRecoveries: number;
  overnightMaxTasks?: number;
  overnightMaxPrs?: number;
  overnightMaxFailures?: number;
  overnightMaxRecoveryAttempts?: number;
  overnightMaxDurationMs?: number;
};

export function buildControlStateSnapshot(
  state: AgentState
): ControlStateSnapshot {
  return {
    paused: state.paused ?? false,
    runnerLocked: state.runnerLocked ?? false,
    runnerLockStartedAt: state.runnerLockStartedAt,
    lastRunAt: state.lastRunAt,
    autoRunEnabled: state.autoRunEnabled ?? false,
    autoMergeEnabled: state.autoMergeEnabled ?? false,
    emergencyStop: state.emergencyStop ?? false,
    recentFailedRuns: state.recentFailedRuns ?? 0,
    recentValidationFailures: state.recentValidationFailures ?? 0,
    recentMergeFailures: state.recentMergeFailures ?? 0,
    recentDeployFailures: state.recentDeployFailures ?? 0,
    failedRuns: state.failedRuns ?? 0,
    lastFailureAt: state.lastFailureAt,
    consecutiveFailures: state.consecutiveFailures ?? 0,
    runtimeBlockedUntil: state.runtimeBlockedUntil,
    runnerHealthStatus: state.runnerHealthStatus ?? "healthy",
    recoveryAutoRunResumeEligible:
      state.recoveryAutoRunResumeEligible ?? false,
    recoveryActive: state.recoveryActive ?? false,
    deployStatus: state.deployStatus,
    deployStartedAt: state.deployStartedAt,
    deployCompletedAt: state.deployCompletedAt,
    deployError: state.deployError,
    lastDeployUrl: state.lastDeployUrl,
    overnightModeActive: state.overnightModeActive ?? false,
    overnightSessionStartedAt: state.overnightSessionStartedAt,
    overnightSessionCompletedAt: state.overnightSessionCompletedAt,
    overnightSessionStopReason: state.overnightSessionStopReason,
    overnightTasksCompleted: state.overnightTasksCompleted ?? 0,
    overnightPrsCreated: state.overnightPrsCreated ?? 0,
    overnightFailures: state.overnightFailures ?? 0,
    overnightRecoveries: state.overnightRecoveries ?? 0,
    overnightMaxTasks: state.overnightMaxTasks,
    overnightMaxPrs: state.overnightMaxPrs,
    overnightMaxFailures: state.overnightMaxFailures,
    overnightMaxRecoveryAttempts: state.overnightMaxRecoveryAttempts,
    overnightMaxDurationMs: state.overnightMaxDurationMs,
  };
}

export async function incrementStateCounter(
  key:
    | "recentFailedRuns"
    | "recentValidationFailures"
    | "recentMergeFailures"
    | "recentDeployFailures",
  message: string
) {
  await updateStateWith(
    (state) => ({
      ...state,
      [key]: (state[key] ?? 0) + 1,
    }),
    message
  );
}

export async function resetRuntimeFailureCounters(message: string) {
  await updateStateWith(
    (state) => ({
      ...state,
      recentFailedRuns: 0,
      recentValidationFailures: 0,
      recentMergeFailures: 0,
      recentDeployFailures: 0,
      failedRuns: 0,
      consecutiveFailures: 0,
      runtimeBlockedUntil: undefined,
    }),
    message
  );
}

export async function trackRuntimeFailure(message: string) {
  await updateStateWith(
    (state) => ({
      ...state,
      failedRuns: (state.failedRuns ?? 0) + 1,
      lastFailureAt: new Date().toISOString(),
      consecutiveFailures: (state.consecutiveFailures ?? 0) + 1,
    }),
    message
  );
}

export function summarizeRunnerHealth(state: AgentState): RunnerHealthStatus {
  const runtimeBlockedUntilMs = state.runtimeBlockedUntil
    ? new Date(state.runtimeBlockedUntil).getTime()
    : 0;

  if (runtimeBlockedUntilMs > Date.now()) {
    return "blocked";
  }

  if ((state.consecutiveFailures ?? 0) >= 2) {
  return "degraded";
}


  return "healthy";
}

export async function releaseRunnerLock() {
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
