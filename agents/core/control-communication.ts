import { logActivity } from "@/app/api/agent-runner/activity";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { readStateFile } from "@/app/api/agent-runner/state";
import { scanObservabilitySignals } from "./observability";
import type { RepoContext } from "./repo-context";
import { readRepoContext } from "./repo-context";

export type ControlGuidance =
  | "approve-next-wave"
  | "pause-runtime"
  | "cooldown-runtime"
  | "inspect-risky-task"
  | "review-failed-deploy"
  | "continue";

export type ControlSummary = {
  currentRuntimeState: string;
  activeExecutionSession: string;
  blockedReasons: string[];
  riskyTaskWarnings: string[];
  recoverySummary: string;
  deployWarnings: string[];
  suggestedNextActions: string[];
  approvalGuidance: string;
  recommendation: ControlGuidance;
};

function formatCount(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function buildCurrentRuntimeState(state: Awaited<ReturnType<typeof readStateFile>>["state"]) {
  if (state.emergencyStop) {
    return "emergency-stop";
  }

  if (state.paused) {
    return "paused";
  }

  const blockedUntilMs = state.runtimeBlockedUntil
    ? new Date(state.runtimeBlockedUntil).getTime()
    : 0;

  if (blockedUntilMs > Date.now()) {
    return "blocked";
  }

  return state.runnerHealthStatus ?? "healthy";
}

function buildActiveSession(state: Awaited<ReturnType<typeof readStateFile>>["state"]) {
  const parts = [
    state.autoRunEnabled === true ? "auto-run on" : "auto-run off",
    state.recoveryActive ? "recovery active" : "recovery idle",
    state.overnightModeActive ? "overnight mode active" : "overnight mode idle",
    state.runnerLocked ? "runner locked" : "runner idle",
  ];

  return parts.join(", ");
}

export async function buildControlSummary(options?: {
  repoContext?: RepoContext;
}) {
  const [repoContext, runtimeMemory, state, observability] = await Promise.all([
    options?.repoContext ? Promise.resolve(options.repoContext) : readRepoContext(),
    readRuntimeMemoryFile().then((result) => result.memory),
    readStateFile().then((result) => result.state),
    scanObservabilitySignals({ repoContext: options?.repoContext }),
  ]);
  const recovery = {
    recommendation: "create-recovery-task" as const,
    observations: [],
    recoveryAttempts: runtimeMemory.recoveryHistory?.length ?? 0,
    failedTargetHits: 0,
    deployFailureCount: runtimeMemory.deployFailures?.length ?? 0,
    blockedRuntime: Boolean(
      state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()
    ),
    runnerHealth: state.runnerHealthStatus ?? "healthy",
  };

  const blockedReasons: string[] = [];
  const riskyTaskWarnings: string[] = [];
  const deployWarnings: string[] = [];
  const suggestedNextActions: string[] = [];

  if (state.emergencyStop) {
    blockedReasons.push("Emergency stop is enabled.");
  }

  if (state.paused) {
    blockedReasons.push("System is paused.");
  }

  if (state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()) {
    blockedReasons.push(`Runtime blocked until ${state.runtimeBlockedUntil}.`);
  }

  if ((state.runnerHealthStatus ?? "healthy") !== "healthy") {
    blockedReasons.push(`Runner health is ${state.runnerHealthStatus ?? "unknown"}.`);
  }

  if ((runtimeMemory.riskyFiles ?? []).some((entry) => (entry.hits ?? 0) > 1)) {
    riskyTaskWarnings.push(
      `${formatCount(
        "risky file",
        (runtimeMemory.riskyFiles ?? []).filter((entry) => (entry.hits ?? 0) > 1).length
      )} with repeated hits.`
    );
  }

  if ((runtimeMemory.failedTasks ?? []).length > 0) {
    riskyTaskWarnings.push(
      `${formatCount("failed task", runtimeMemory.failedTasks?.length ?? 0)} in runtime memory.`
    );
  }

  if ((runtimeMemory.recoveryHistory ?? []).length > 0) {
    const recentRecovery = runtimeMemory.recoveryHistory?.[0];
    riskyTaskWarnings.push(
      `Latest recovery status: ${recentRecovery?.status ?? "unknown"}${recentRecovery?.reason ? ` - ${recentRecovery.reason}` : ""}.`
    );
  }

  if (state.deployStatus === "failed" || (runtimeMemory.deployFailures ?? []).length > 0) {
    deployWarnings.push(
      state.deployError
        ? `Deploy issue: ${state.deployError}.`
        : `${formatCount("deploy failure", runtimeMemory.deployFailures?.length ?? 0)} recorded.`
    );
  }

  if (observability.recommendation !== "ok") {
    suggestedNextActions.push(`Observability suggests ${observability.recommendation}.`);
  }

  if (recovery.recommendation !== "create-recovery-task") {
    suggestedNextActions.push(`Recovery intelligence suggests ${recovery.recommendation}.`);
  }

  if (state.emergencyStop || state.paused) {
    suggestedNextActions.push("Pause execution and inspect the current session.");
  } else if (state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()) {
    suggestedNextActions.push("Wait for the runtime block to expire.");
  } else if ((state.runnerHealthStatus ?? "healthy") !== "healthy") {
    suggestedNextActions.push("Cooldown the runtime and inspect the runner health.");
  } else if ((runtimeMemory.riskyFiles ?? []).some((entry) => (entry.hits ?? 0) > 1)) {
    suggestedNextActions.push("Inspect the most repeated risky file before continuing.");
  } else if (state.deployStatus === "failed") {
    suggestedNextActions.push("Review the failed deploy before approving the next wave.");
  } else {
    suggestedNextActions.push("Approve the next wave or continue execution.");
  }

  const recommendation: ControlGuidance =
    state.emergencyStop || state.paused
      ? "pause-runtime"
      : state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()
        ? "cooldown-runtime"
        : state.deployStatus === "failed"
          ? "review-failed-deploy"
          : (runtimeMemory.riskyFiles ?? []).some((entry) => (entry.hits ?? 0) > 1)
            ? "inspect-risky-task"
            : (state.runnerHealthStatus ?? "healthy") !== "healthy"
              ? "cooldown-runtime"
              : observability.recommendation === "requiresApproval"
                ? "approve-next-wave"
                : "continue";

  const summary: ControlSummary = {
    currentRuntimeState: buildCurrentRuntimeState(state),
    activeExecutionSession: buildActiveSession(state),
    blockedReasons,
    riskyTaskWarnings,
    recoverySummary: `recoveries=${runtimeMemory.recoveryHistory?.length ?? 0}, recoveryRecommendation=${recovery.recommendation}`,
    deployWarnings,
    suggestedNextActions,
    approvalGuidance:
      recommendation === "approve-next-wave"
        ? "Approval looks safe for the next wave."
        : recommendation === "pause-runtime"
          ? "Do not approve more work until the runtime is stabilized."
          : recommendation === "review-failed-deploy"
            ? "Review the failed deploy before approving more execution."
            : recommendation === "cooldown-runtime"
              ? "Cooldown the runtime before new approvals."
              : "Continue only if the next task stays within the current safety gates.",
    recommendation,
  };

  await logActivity({
    type: "control-summary-generated",
    recommendation,
    currentRuntimeState: summary.currentRuntimeState,
    blockedReasons: JSON.stringify(blockedReasons),
    riskyTaskWarnings: JSON.stringify(riskyTaskWarnings),
    deployWarnings: JSON.stringify(deployWarnings),
  }).catch(() => {});

  return summary;
}
