import { NextResponse } from "next/server";
import { buildControlStateSnapshot } from "../agent-runner/state";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const STATE_PATH = ".agent/state.json";

type ControlState = {
  paused?: boolean;
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
  recoveryActive?: boolean;
  recentFailedRuns?: number;
  recentValidationFailures?: number;
  recentMergeFailures?: number;
  recentDeployFailures?: number;
  consecutiveFailures?: number;
  runtimeBlockedUntil?: string;
  runnerHealthStatus?: "healthy" | "degraded" | "blocked";
  recoveryAutoRunResumeEligible?: boolean;
  deployStatus?: "pending" | "success" | "failed";
  deployStartedAt?: string;
  deployCompletedAt?: string;
  deployError?: string;
  lastDeployUrl?: string;
  overnightModeActive?: boolean;
  overnightSessionStartedAt?: string;
  overnightSessionCompletedAt?: string;
  overnightSessionStopReason?: string;
  overnightTasksCompleted?: number;
  overnightPrsCreated?: number;
  overnightFailures?: number;
  overnightRecoveries?: number;
  overnightMaxTasks?: number;
  overnightMaxPrs?: number;
  overnightMaxFailures?: number;
  overnightMaxRecoveryAttempts?: number;
  overnightMaxDurationMs?: number;
};

type GitHubFile = {
  content: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __MASTER_AGENT_CONTROL_STATE_OVERRIDE__: ControlState | undefined;
}

function getRuntimeControlState() {
  if (!globalThis.__MASTER_AGENT_CONTROL_STATE_OVERRIDE__) {
    globalThis.__MASTER_AGENT_CONTROL_STATE_OVERRIDE__ = {};
  }

  return globalThis.__MASTER_AGENT_CONTROL_STATE_OVERRIDE__;
}

async function readStateFile() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return {};
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${STATE_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return {};
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return JSON.parse(content) as ControlState;
}

function applyControlStatePatch(
  currentState: ControlState,
  body: Record<string, unknown>,
): ControlState {
  const nextState: ControlState = {
    ...currentState,
  };

  if (typeof body.paused === "boolean") {
    nextState.paused = body.paused;
  }

  if (typeof body.autoRunEnabled === "boolean") {
    nextState.autoRunEnabled = body.autoRunEnabled;
  }

  if (typeof body.autoMergeEnabled === "boolean") {
    nextState.autoMergeEnabled = body.autoMergeEnabled;
  }

  if (typeof body.emergencyStop === "boolean") {
    nextState.emergencyStop = body.emergencyStop;
  }

  if (typeof body.recoveryActive === "boolean") {
    nextState.recoveryActive = body.recoveryActive;
  }

  if (typeof body.recoveryAutoRunResumeEligible === "boolean") {
    nextState.recoveryAutoRunResumeEligible =
      body.recoveryAutoRunResumeEligible;
  }

  if (typeof body.overnightModeActive === "boolean") {
    nextState.overnightModeActive = body.overnightModeActive;
  }

  if (
    typeof body.overnightSessionStartedAt === "string" ||
    body.overnightSessionStartedAt === null
  ) {
    nextState.overnightSessionStartedAt =
      body.overnightSessionStartedAt ?? undefined;
  }

  if (
    typeof body.overnightSessionCompletedAt === "string" ||
    body.overnightSessionCompletedAt === null
  ) {
    nextState.overnightSessionCompletedAt =
      body.overnightSessionCompletedAt ?? undefined;
  }

  if (
    typeof body.overnightSessionStopReason === "string" ||
    body.overnightSessionStopReason === null
  ) {
    nextState.overnightSessionStopReason =
      body.overnightSessionStopReason ?? undefined;
  }

  if (typeof body.overnightTasksCompleted === "number") {
    nextState.overnightTasksCompleted = body.overnightTasksCompleted;
  }

  if (typeof body.overnightPrsCreated === "number") {
    nextState.overnightPrsCreated = body.overnightPrsCreated;
  }

  if (typeof body.overnightFailures === "number") {
    nextState.overnightFailures = body.overnightFailures;
  }

  if (typeof body.overnightRecoveries === "number") {
    nextState.overnightRecoveries = body.overnightRecoveries;
  }

  if (typeof body.overnightMaxTasks === "number") {
    nextState.overnightMaxTasks = body.overnightMaxTasks;
  }

  if (typeof body.overnightMaxPrs === "number") {
    nextState.overnightMaxPrs = body.overnightMaxPrs;
  }

  if (typeof body.overnightMaxFailures === "number") {
    nextState.overnightMaxFailures = body.overnightMaxFailures;
  }

  if (typeof body.overnightMaxRecoveryAttempts === "number") {
    nextState.overnightMaxRecoveryAttempts = body.overnightMaxRecoveryAttempts;
  }

  if (typeof body.overnightMaxDurationMs === "number") {
    nextState.overnightMaxDurationMs = body.overnightMaxDurationMs;
  }

  if (
    typeof body.runtimeBlockedUntil === "string" ||
    body.runtimeBlockedUntil === null
  ) {
    nextState.runtimeBlockedUntil = body.runtimeBlockedUntil ?? undefined;
  }

  if (body.clearRecovery === true) {
    nextState.recoveryActive = false;
    nextState.recoveryAutoRunResumeEligible = false;
    nextState.runtimeBlockedUntil = undefined;
    nextState.recentFailedRuns = 0;
    nextState.recentValidationFailures = 0;
    nextState.recentMergeFailures = 0;
    nextState.recentDeployFailures = 0;
  }

  if (body.clearOvernightSession === true) {
    nextState.overnightModeActive = false;
    nextState.overnightSessionStartedAt = undefined;
    nextState.overnightSessionCompletedAt = undefined;
    nextState.overnightSessionStopReason = undefined;
    nextState.overnightTasksCompleted = 0;
    nextState.overnightPrsCreated = 0;
    nextState.overnightFailures = 0;
    nextState.overnightRecoveries = 0;
  }

  return nextState;
}

export async function GET() {
  try {
    const persistedState = await readStateFile();
    const runtimeState = getRuntimeControlState();
    const state = {
      ...persistedState,
      ...runtimeState,
    };

    return NextResponse.json({
      ok: true,
      state: buildControlStateSnapshot(state),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const persistedState = await readStateFile();
    const runtimeState = getRuntimeControlState();
    const currentState = {
      ...persistedState,
      ...runtimeState,
    };
    const nextState = applyControlStatePatch(currentState, body);

    globalThis.__MASTER_AGENT_CONTROL_STATE_OVERRIDE__ = {
      ...runtimeState,
      ...nextState,
    };

    return NextResponse.json({
      ok: true,
      mode: "runtime-only-control-state",
      state: buildControlStateSnapshot(nextState),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
