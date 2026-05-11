import { NextResponse } from "next/server";

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
  sha: string;
  content: string;
};

async function readStateFile() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
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
    throw new Error(`Failed to read ${STATE_PATH}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    state: JSON.parse(content) as ControlState,
    sha: file.sha,
  };
}

async function writeStateFile(
  state: ControlState,
  sha: string,
  message: string,
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(state, null, 2) + "\n").toString(
    "base64",
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${STATE_PATH}`,
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
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${STATE_PATH}: ${res.status} ${text}`);
  }
}

export async function GET() {
  try {
    const { state } = await readStateFile();

    return NextResponse.json({
      ok: true,
      state: {
        paused: state.paused ?? false,
        runnerLocked: state.runnerLocked ?? false,
        runnerLockStartedAt: state.runnerLockStartedAt,
        lastRunAt: state.lastRunAt,
        autoRunEnabled: state.autoRunEnabled ?? false,
        autoMergeEnabled: state.autoMergeEnabled ?? false,
        emergencyStop: state.emergencyStop ?? false,
        recoveryActive: state.recoveryActive ?? false,
recentFailedRuns: state.recentFailedRuns ?? 0,
recentValidationFailures:
  state.recentValidationFailures ?? 0,
recentMergeFailures:
  state.recentMergeFailures ?? 0,
        recentDeployFailures:
          state.recentDeployFailures ?? 0,
        consecutiveFailures:
          state.consecutiveFailures ?? 0,
        runtimeBlockedUntil:
          state.runtimeBlockedUntil,
        runnerHealthStatus:
          state.runnerHealthStatus ?? "healthy",
        recoveryAutoRunResumeEligible:
          state.recoveryAutoRunResumeEligible ?? false,
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
      },
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
    const body = await req.json();
    const { state, sha } = await readStateFile();

    const nextState: ControlState = {
      ...state,
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
      nextState.runtimeBlockedUntil =
        body.runtimeBlockedUntil ?? undefined;
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

    await writeStateFile(nextState, sha, "Update Master Agent control state");

    return NextResponse.json({
      ok: true,
      state: nextState,
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
