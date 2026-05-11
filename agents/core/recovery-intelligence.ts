import { logActivity } from "@/app/api/agent-runner/activity";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { readStateFile } from "@/app/api/agent-runner/state";
import { scanObservabilitySignals } from "./observability";

export type RecoveryIntelligenceRecommendation =
  | "create-recovery-task"
  | "retry-later"
  | "require-approval"
  | "split-task"
  | "stop-execution"
  | "cooldown-runtime";

export type RecoveryIntelligenceObservation = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type RecoveryIntelligenceResult = {
  recommendation: RecoveryIntelligenceRecommendation;
  observations: RecoveryIntelligenceObservation[];
  recoveryAttempts: number;
  failedTargetHits: number;
  deployFailureCount: number;
  blockedRuntime: boolean;
  runnerHealth: string;
};

function countRecoveryAttempts(memory: Awaited<ReturnType<typeof readRuntimeMemoryFile>>["memory"], taskId: string) {
  return (memory.recoveryHistory ?? []).filter(
    (entry) => entry.taskId === taskId && entry.status !== "duplicate-blocked"
  ).length;
}

function countFailedTargetHits(memory: Awaited<ReturnType<typeof readRuntimeMemoryFile>>["memory"], targetFile?: string) {
  if (!targetFile) {
    return 0;
  }

  return (
    memory.riskyFiles?.find((entry) => entry.targetFile === targetFile)?.hits ?? 0
  );
}

export async function analyzeRecoveryIntelligence(options: {
  taskId: string;
  targetFile?: string;
  reason?: string;
}) {
  const [runtimeMemory, state, observability] = await Promise.all([
    readRuntimeMemoryFile().then((result) => result.memory),
    readStateFile().then((result) => result.state),
    scanObservabilitySignals(),
  ]);

  const recoveryAttempts = countRecoveryAttempts(runtimeMemory, options.taskId);
  const failedTargetHits = countFailedTargetHits(runtimeMemory, options.targetFile);
  const deployFailureCount = runtimeMemory.deployFailures?.length ?? 0;
  const blockedRuntime = Boolean(
    state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()
  );
  const runnerHealth = state.runnerHealthStatus ?? "healthy";
  const observations: RecoveryIntelligenceObservation[] = [];

  if (options.reason) {
    observations.push({
      code: "failure-reason",
      severity: "low",
      detail: options.reason,
    });
  }

  if (recoveryAttempts >= 2) {
    observations.push({
      code: "recovery-loop",
      severity: "high",
      detail: `${recoveryAttempts} recovery attempts are already recorded for this task.`,
    });
  }

  if (failedTargetHits > 1) {
    observations.push({
      code: "failed-target-repeats",
      severity: "high",
      detail: `Target file has repeated failure hits: ${options.targetFile ?? "(missing)"}.`,
    });
  }

  if (deployFailureCount > 0) {
    observations.push({
      code: "deploy-failure-context",
      severity: "medium",
      detail: `${deployFailureCount} deploy failure(s) are present in runtime memory.`,
    });
  }

  if (observability.recommendation !== "ok") {
    observations.push({
      code: "observability-anomaly",
      severity: "medium",
      detail: `Observability recommended ${observability.recommendation}.`,
    });
  }

  if (blockedRuntime) {
    observations.push({
      code: "blocked-runtime",
      severity: "high",
      detail: "Runtime is currently blocked.",
    });
  }

  if (runnerHealth !== "healthy") {
    observations.push({
      code: "runner-health",
      severity: "medium",
      detail: `Runner health is ${runnerHealth}.`,
    });
  }

  let recommendation: RecoveryIntelligenceRecommendation = "create-recovery-task";

  if (blockedRuntime || runnerHealth === "blocked") {
    recommendation = "stop-execution";
  } else if (recoveryAttempts >= 2 || failedTargetHits > 1) {
    recommendation = "cooldown-runtime";
  } else if (deployFailureCount > 0 || observability.recommendation === "runtime-cooldown") {
    recommendation = "retry-later";
  } else if (observability.recommendation === "execution-stop-suggestion") {
    recommendation = "stop-execution";
  } else if (observability.recommendation === "requiresApproval") {
    recommendation = "require-approval";
  } else if (observability.recommendation === "recovery-caution") {
    recommendation = "retry-later";
  } else if (observability.repeatedRiskyFiles.length > 0) {
    recommendation = "split-task";
  }

  await logActivity({
    type: "recovery-intelligence-completed",
    taskId: options.taskId,
    targetFile: options.targetFile,
    recommendation,
    recoveryAttempts,
    failedTargetHits,
    deployFailureCount,
    blockedRuntime,
    runnerHealth,
  }).catch(() => {});

  return {
    recommendation,
    observations,
    recoveryAttempts,
    failedTargetHits,
    deployFailureCount,
    blockedRuntime,
    runnerHealth,
  } satisfies RecoveryIntelligenceResult;
}
