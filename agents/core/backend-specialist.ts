import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type BackendReviewRecommendation =
  | "approve"
  | "backend-review"
  | "requiresApproval"
  | "previewOnly"
  | "split"
  | "avoid-critical-runtime";

export type BackendReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type BackendReviewResult = {
  recommendation: BackendReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: BackendReviewSignal[];
};

export type BackendReviewTask = {
  id: string;
  title: string;
  targetFile: string;
  summary?: string;
  priority?: string;
  executionMode?: string;
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  parentTaskId?: string;
  dependsOnTaskIds?: string[];
  blockedBy?: string[];
  riskLevel?: string;
  plannerNotes?: string;
};

const CRITICAL_RUNTIME_PREFIXES = [
  "app/api/agent-runner/",
  "app/api/auto-run/",
  "app/api/control-state/",
  "app/api/deploy-status/",
  "app/api/create-task/",
  "app/api/planner-waves/",
  "app/api/approve-",
  "agents/core/",
];

function countList(value?: string[]) {
  return Array.isArray(value) ? value.length : 0;
}

function countRiskHits(memory: RuntimeMemory, targetFile: string) {
  return (
    memory.riskyFiles?.find((entry) => entry.targetFile === targetFile)?.hits ?? 0
  );
}

function isBackendTarget(targetFile: string, context: RepoContext) {
  const normalized = targetFile.trim();

  if (!normalized) {
    return false;
  }

  if ((context.backendFiles ?? []).includes(normalized)) {
    return true;
  }

  return (
    normalized.startsWith("app/api/") ||
    normalized.startsWith("app/lib/") ||
    normalized.startsWith("agents/core/") ||
    normalized.startsWith("app/api/")
  );
}

function isCriticalRuntimeTarget(targetFile: string) {
  return CRITICAL_RUNTIME_PREFIXES.some((prefix) => targetFile.startsWith(prefix));
}

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

function hasBackendIntent(task: BackendReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "backend",
    "api",
    "route",
    "runtime",
    "state",
    "deploy",
    "orchestration",
    "recovery",
    "server",
    "module",
  ].some((hint) => haystack.includes(hint));
}

function isDeploySensitiveTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/merge-pr/") ||
    targetFile.startsWith("app/api/validate-pr/")
  );
}

function isStateOrRecoveryTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/recovery-") ||
    targetFile.startsWith("app/api/deploy-recovery/") ||
    targetFile.startsWith("app/api/agent-runner/state") ||
    targetFile.startsWith("app/api/agent-runner/tasks") ||
    targetFile.startsWith("app/api/agent-runner/memory")
  );
}

function isOrchestrationTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/planner-waves/") ||
    targetFile.startsWith("app/api/create-task/")
  );
}

export function shouldReviewBackendTask(
  task: BackendReviewTask,
  context?: RepoContext
) {
  const targetFile = String(task.targetFile ?? "").trim();

  if (!targetFile) {
    return hasBackendIntent(task);
  }

  if (context) {
    const activeHints = getActiveFileHints(context);
    if (activeHints.includes(targetFile) && isBackendTarget(targetFile, context)) {
      return true;
    }
  }

  return (
    isBackendTarget(targetFile, context ?? { backendFiles: [] }) ||
    hasBackendIntent(task)
  );
}

export async function reviewBackendTask(
  task: BackendReviewTask,
  options?: {
    repoContext?: RepoContext;
    runtimeMemory?: RuntimeMemory;
  }
) {
  const [context, memory] = await Promise.all([
    options?.repoContext ? Promise.resolve(options.repoContext) : readRepoContext(),
    options?.runtimeMemory
      ? Promise.resolve(options.runtimeMemory)
      : readRuntimeMemoryFile().then((result) => result.memory),
  ]);

  const signals: BackendReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const backendTarget = isBackendTarget(targetFile, context);
  const criticalRuntime = isCriticalRuntimeTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const deploySensitive = isDeploySensitiveTarget(targetFile);
  const stateOrRecovery = isStateOrRecoveryTarget(targetFile);
  const orchestrationTarget = isOrchestrationTarget(targetFile);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (backendTarget ? 1 : 0) +
    (criticalRuntime ? 2 : 0);

  if (!targetFile) {
    signals.push({
      code: "missing-target",
      severity: "high",
      detail: "Task is missing a target file.",
    });
    score += 4;
  }

  if (backendTarget) {
    signals.push({
      code: "backend-surface",
      severity: "low",
      detail: `Target is in a backend or API surface: ${targetFile}`,
    });
  }

  if (criticalRuntime) {
    signals.push({
      code: "critical-runtime",
      severity: "high",
      detail: `Target touches critical runtime orchestration code: ${targetFile}`,
    });
    score += 3;
  }

  if (deploySensitive) {
    signals.push({
      code: "deploy-sensitive",
      severity: "high",
      detail: `Target can affect deploy safety or merge flow: ${targetFile}`,
    });
    score += 2;
  }

  if (stateOrRecovery) {
    signals.push({
      code: "state-recovery-impact",
      severity: "medium",
      detail: `Target affects state, recovery, or runtime control: ${targetFile}`,
    });
    score += 2;
  }

  if (orchestrationTarget) {
    signals.push({
      code: "orchestration-impact",
      severity: "medium",
      detail: `Target affects orchestration flow: ${targetFile}`,
    });
    score += 1;
  }

  if (legacyTarget) {
    signals.push({
      code: "legacy-target",
      severity: "high",
      detail: `Target is in a legacy or deprecated area: ${targetFile}`,
    });
    score += 3;
  }

  if (riskyHits > 1) {
    signals.push({
      code: "repeated-risk",
      severity: "high",
      detail: `Target file has been risky ${riskyHits} times.`,
    });
    score += 3;
  } else if (riskyHits === 1) {
    signals.push({
      code: "known-risk",
      severity: "medium",
      detail: "Target file has been risky before.",
    });
    score += 1;
  }

  if (dependencyCount > 0) {
    signals.push({
      code: "dependencies",
      severity: dependencyCount > 2 ? "medium" : "low",
      detail: `${dependencyCount} dependency link${dependencyCount === 1 ? "" : "s"} present.`,
    });
    score += dependencyCount > 2 ? 2 : 1;
  }

  if (blockedCount > 0) {
    signals.push({
      code: "blocked-by",
      severity: "medium",
      detail: `${blockedCount} blocking reference${blockedCount === 1 ? "" : "s"} present.`,
    });
    score += 1;
  }

  if (task.executionMode === "multi-step") {
    signals.push({
      code: "multi-step",
      severity: "medium",
      detail: "Task is marked multi-step.",
    });
    score += 1;
  }

  if (scopeSize >= 5) {
    signals.push({
      code: "oversized-scope",
      severity: "medium",
      detail: `Scope size is ${scopeSize}, which suggests splitting the backend work.`,
    });
    score += 2;
  }

  let recommendation: BackendReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || legacyTarget || criticalRuntime) {
    recommendation = "avoid-critical-runtime";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (scopeSize >= 5 || dependencyCount > 1 || blockedCount > 0) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (deploySensitive || stateOrRecovery || orchestrationTarget || riskyHits > 0) {
    recommendation = "backend-review";
    previewOnly = true;
    requiresApproval = true;
  } else if (score >= 2) {
    recommendation = "requiresApproval";
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "backend-review") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "requiresApproval") {
    requiresApproval = true;
  }

  if (recommendation === "split") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "avoid-critical-runtime") {
    previewOnly = true;
    requiresApproval = true;
  }

  await logActivity({
    type: "backend-review-completed",
    taskId: task.id,
    targetFile,
    recommendation,
    scopeSize,
    previewOnly,
    requiresApproval,
    shouldSplit,
    signals: JSON.stringify(signals.slice(0, 8)),
  }).catch(() => {});

  return {
    recommendation,
    previewOnly,
    requiresApproval,
    shouldSplit,
    scopeSize,
    signals,
  } satisfies BackendReviewResult;
}

export function applyBackendReview(
  task: BackendReviewTask,
  review: BackendReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Backend review: ${review.recommendation} (scope ${review.scopeSize}).`;

  return {
    ...task,
    previewOnly: review.previewOnly || task.previewOnly === true,
    requiresApproval: review.requiresApproval || task.requiresApproval === true,
    riskLevel:
      review.recommendation === "approve" ? task.riskLevel : "high",
    plannerNotes: existingNotes
      ? `${existingNotes} ${reviewNote}`
      : reviewNote,
  };
}
