import { logActivity } from "@/app/api/agent-runner/activity";
import {
  readRuntimeMemoryFile,
  recordRuntimeObservationSummary,
} from "@/app/api/agent-runner/memory";
import { readStateFile } from "@/app/api/agent-runner/state";
import type { RepoContext } from "./repo-context";
import { readRepoContext } from "./repo-context";

export type ObservabilityObservation = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type ObservabilityResult = {
  recommendation:
    | "ok"
    | "requiresApproval"
    | "runtime-cooldown"
    | "recovery-caution"
    | "execution-stop-suggestion";
  observations: ObservabilityObservation[];
  repeatedRiskyFiles: Array<{
    targetFile: string;
    hits: number;
  }>;
  summary: {
    failedTasks: number;
    recoveryEvents: number;
    deployFailures: number;
    blockedRuntime: boolean;
    unhealthyRunner: boolean;
    stalledChains: number;
  };
};

function summarizeStalledChains(context: RepoContext) {
  return (context.activeRuntimeAreas ?? []).filter((targetFile) =>
    /agent-runner|auto-run|deploy-status|recovery|pending-pr/.test(targetFile)
  ).length;
}

function pickRepeatedRiskyFiles(context: RepoContext) {
  return (context.riskyFiles ?? [])
    .filter((entry) => (entry.hits ?? 0) > 1)
    .sort((a, b) => (b.hits ?? 0) - (a.hits ?? 0))
    .slice(0, 8)
    .map((entry) => ({
      targetFile: entry.targetFile,
      hits: entry.hits ?? 0,
    }));
}

export async function scanObservabilitySignals(options?: {
  repoContext?: RepoContext;
}) {
  const [repoContext, runtimeMemory, state] = await Promise.all([
    options?.repoContext ? Promise.resolve(options.repoContext) : readRepoContext(),
    readRuntimeMemoryFile().then((result) => result.memory),
    readStateFile().then((result) => result.state),
  ]);

  const failedTasks = runtimeMemory.failedTasks?.length ?? 0;
  const recoveryEvents = runtimeMemory.recoveryHistory?.length ?? 0;
  const deployFailures = runtimeMemory.deployFailures?.length ?? 0;
  const blockedRuntime = Boolean(
    state.runtimeBlockedUntil && new Date(state.runtimeBlockedUntil).getTime() > Date.now()
  );
  const unhealthyRunner = (state.runnerHealthStatus ?? "healthy") !== "healthy";
  const stalledChains = summarizeStalledChains(repoContext);
  const repeatedRiskyFiles = pickRepeatedRiskyFiles(repoContext);
  const observations: ObservabilityObservation[] = [];
  let score = 0;

  if (failedTasks >= 3) {
    observations.push({
      code: "failure-spike",
      severity: "high",
      detail: `${failedTasks} failed tasks are present in runtime memory.`,
    });
    score += 3;
  }

  if (recoveryEvents >= 3) {
    observations.push({
      code: "recovery-spike",
      severity: "medium",
      detail: `${recoveryEvents} recovery events are recorded.`,
    });
    score += 2;
  }

  if (deployFailures >= 2) {
    observations.push({
      code: "deploy-failures",
      severity: "high",
      detail: `${deployFailures} deploy failures are recorded.`,
    });
    score += 3;
  }

  if (blockedRuntime) {
    observations.push({
      code: "runtime-blocked",
      severity: "high",
      detail: "Runtime is currently blocked.",
    });
    score += 3;
  }

  if (unhealthyRunner) {
    observations.push({
      code: "runner-unhealthy",
      severity: "medium",
      detail: `Runner health is ${state.runnerHealthStatus ?? "unknown"}.`,
    });
    score += 1;
  }

  if (repeatedRiskyFiles.length > 0) {
    observations.push({
      code: "repeated-risky-files",
      severity: "medium",
      detail: `${repeatedRiskyFiles.length} risky file(s) have repeated hits.`,
    });
    score += 2;
  }

  if (stalledChains >= 3) {
    observations.push({
      code: "stalled-chain",
      severity: "medium",
      detail: `${stalledChains} runtime areas look stalled or stuck.`,
    });
    score += 1;
  }

  const recommendation =
    blockedRuntime || deployFailures >= 2
      ? "execution-stop-suggestion"
      : failedTasks >= 3 || recoveryEvents >= 3
        ? "recovery-caution"
        : repeatedRiskyFiles.length > 0 || unhealthyRunner
          ? "runtime-cooldown"
          : score >= 2
            ? "requiresApproval"
            : "ok";

  await logActivity({
    type: "observability-scan-completed",
    recommendation,
    failedTasks,
    recoveryEvents,
    deployFailures,
    blockedRuntime,
    unhealthyRunner,
    stalledChains,
  }).catch(() => {});

  if (observations.length > 0) {
    await logActivity({
      type: "runtime-anomaly-detected",
      recommendation,
      details: JSON.stringify(observations.slice(0, 8)),
    }).catch(() => {});
  }

  await recordRuntimeObservationSummary({
    code: "observability-scan",
    recommendation,
    detail: `Failed tasks: ${failedTasks}, recoveries: ${recoveryEvents}, deploy failures: ${deployFailures}`,
  }).catch(() => {});

  return {
    recommendation,
    observations,
    repeatedRiskyFiles,
    summary: {
      failedTasks,
      recoveryEvents,
      deployFailures,
      blockedRuntime,
      unhealthyRunner,
      stalledChains,
    },
  } satisfies ObservabilityResult;
}
