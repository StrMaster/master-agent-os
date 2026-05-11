import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type PerformanceReviewRecommendation =
  | "approve"
  | "runtime-optimization"
  | "execution-caution"
  | "cooldown-increase"
  | "split"
  | "avoid-heavy-orchestration-coupling";

export type PerformanceReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type PerformanceReviewResult = {
  recommendation: PerformanceReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: PerformanceReviewSignal[];
};

export type PerformanceReviewTask = {
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

const PERFORMANCE_HINTS = [
  "performance",
  "slow",
  "bottleneck",
  "polling",
  "loop",
  "latency",
  "throughput",
  "optimization",
  "optimize",
  "render",
  "rendering",
  "memo",
  "cache",
  "heavy",
  "recovery",
];

function countList(value?: string[]) {
  return Array.isArray(value) ? value.length : 0;
}

function countRiskHits(memory: RuntimeMemory, targetFile: string) {
  return (
    memory.riskyFiles?.find((entry) => entry.targetFile === targetFile)?.hits ?? 0
  );
}

function isFrontendTarget(targetFile: string, context: RepoContext) {
  const normalized = targetFile.trim();

  if (!normalized) {
    return false;
  }

  if ((context.frontendFiles ?? []).includes(normalized)) {
    return true;
  }

  return (
    normalized === "app/page.tsx" ||
    normalized === "app/execution/page.tsx" ||
    normalized === "app/tasks/page.tsx" ||
    normalized.startsWith("app/components/")
  );
}

function isRuntimeOrBackendTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/") ||
    targetFile.startsWith("agents/core/") ||
    targetFile.startsWith("app/lib/") ||
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/create-task/") ||
    targetFile.startsWith("app/api/planner-waves/")
  );
}

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

function hasPerformanceIntent(task: PerformanceReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return PERFORMANCE_HINTS.some((hint) => haystack.includes(hint));
}

function isHeavyOrchestrationTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/recovery-") ||
    targetFile.startsWith("app/api/planner-waves/")
  );
}

function hasPollLoopSignals(task: PerformanceReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["poll", "polling", "interval", "refresh", "repeated", "loop"].some((hint) =>
    haystack.includes(hint)
  );
}

function hasFrontendRenderRisk(task: PerformanceReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "render",
    "rerender",
    "list",
    "table",
    "feed",
    "expensive",
    "virtualize",
    "memo",
    "cache",
  ].some((hint) => haystack.includes(hint));
}

export function shouldReviewPerformanceTask(
  task: PerformanceReviewTask,
  context?: RepoContext
) {
  const targetFile = String(task.targetFile ?? "").trim();

  if (!targetFile) {
    return hasPerformanceIntent(task);
  }

  if (context) {
    const activeHints = getActiveFileHints(context);
    if (activeHints.includes(targetFile)) {
      return true;
    }
  }

  return hasPerformanceIntent(task);
}

export async function reviewPerformanceTask(
  task: PerformanceReviewTask,
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

  const signals: PerformanceReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const frontendTarget = isFrontendTarget(targetFile, context);
  const runtimeOrBackend = isRuntimeOrBackendTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const heavyOrchestration = isHeavyOrchestrationTarget(targetFile);
  const pollSignals = hasPollLoopSignals(task);
  const renderRisk = hasFrontendRenderRisk(task);
  const recoveryOverhead =
    (memory.recoveryHistory?.length ?? 0) + (runtimeOrBackend ? 1 : 0);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (frontendTarget ? 1 : 0) +
    (runtimeOrBackend ? 2 : 0) +
    (heavyOrchestration ? 2 : 0);

  if (frontendTarget) {
    signals.push({
      code: "frontend-impact",
      severity: "low",
      detail: `Target is a frontend surface: ${targetFile}`,
    });
  }

  if (!targetFile) {
    signals.push({
      code: "missing-target",
      severity: "high",
      detail: "Task is missing a target file.",
    });
    score += 4;
  }

  if (runtimeOrBackend) {
    signals.push({
      code: "runtime-backend",
      severity: "high",
      detail: `Target touches runtime or backend code: ${targetFile}`,
    });
    score += 2;
  }

  if (heavyOrchestration) {
    signals.push({
      code: "heavy-orchestration",
      severity: "high",
      detail: `Target touches heavy orchestration surfaces: ${targetFile}`,
    });
    score += 3;
  }

  if (pollSignals) {
    signals.push({
      code: "polling",
      severity: "medium",
      detail: "Task appears to involve polling or repeated refresh behavior.",
    });
    score += 2;
  }

  if (renderRisk) {
    signals.push({
      code: "render-risk",
      severity: "medium",
      detail: "Task appears to carry inefficient frontend rendering risk.",
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

  if (recoveryOverhead >= 3) {
    signals.push({
      code: "recovery-overhead",
      severity: "medium",
      detail: "Recovery history suggests extra execution overhead.",
    });
    score += 2;
  }

  if (scopeSize >= 5) {
    signals.push({
      code: "oversized-scope",
      severity: "medium",
      detail: `Scope size is ${scopeSize}, which suggests splitting the performance work.`,
    });
    score += 2;
  }

  const performanceIntent = hasPerformanceIntent(task);

  if (performanceIntent) {
    signals.push({
      code: "performance-intent",
      severity: "low",
      detail: "Task explicitly references performance or efficiency concerns.",
    });
  }

  let recommendation: PerformanceReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || legacyTarget) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (heavyOrchestration || scopeSize >= 6 || dependencyCount > 2 || blockedCount > 1) {
    recommendation = "avoid-heavy-orchestration-coupling";
    previewOnly = true;
    requiresApproval = true;
  } else if (pollSignals || recoveryOverhead >= 3 || riskyHits > 1) {
    recommendation = "cooldown-increase";
    previewOnly = true;
    requiresApproval = true;
  } else if (runtimeOrBackend || renderRisk || dependencyCount > 0 || blockedCount > 0) {
    recommendation = "execution-caution";
    previewOnly = true;
    requiresApproval = true;
  } else if (performanceIntent || score >= 2) {
    recommendation = "runtime-optimization";
  }

  if (recommendation === "split") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "avoid-heavy-orchestration-coupling") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "cooldown-increase") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "execution-caution") {
    previewOnly = true;
    requiresApproval = true;
  }

  await logActivity({
    type: "performance-review-completed",
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
  } satisfies PerformanceReviewResult;
}

export function applyPerformanceReview(
  task: PerformanceReviewTask,
  review: PerformanceReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Performance review: ${review.recommendation} (scope ${review.scopeSize}).`;

  return {
    ...task,
    previewOnly: review.previewOnly || task.previewOnly === true,
    requiresApproval: review.requiresApproval || task.requiresApproval === true,
    riskLevel:
      review.recommendation === "approve" || review.recommendation === "runtime-optimization"
        ? task.riskLevel
        : "high",
    plannerNotes: existingNotes
      ? `${existingNotes} ${reviewNote}`
      : reviewNote,
  };
}
