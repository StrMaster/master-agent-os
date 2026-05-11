import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type ArchitectureReviewRecommendation =
  | "approve"
  | "previewOnly"
  | "requiresApproval"
  | "split";

export type ArchitectureReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type ArchitectureReviewResult = {
  recommendation: ArchitectureReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: ArchitectureReviewSignal[];
};

export type ArchitectureReviewTask = {
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

function isRuntimeArea(targetFile: string) {
  return (
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/create-task/") ||
    targetFile.startsWith("app/api/planner-waves/") ||
    targetFile.startsWith("app/api/approve-") ||
    targetFile.startsWith("agents/core/") ||
    targetFile.startsWith("app/lib/")
  );
}

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

function countList(value?: string[]) {
  return Array.isArray(value) ? value.length : 0;
}

function countRiskHits(memory: RuntimeMemory, targetFile: string) {
  return (
    memory.riskyFiles?.find((entry) => entry.targetFile === targetFile)?.hits ?? 0
  );
}

function isUnsafeOrMissingTarget(targetFile: string, context: RepoContext) {
  const activeHints = getActiveFileHints(context);

  if (!targetFile.trim()) {
    return true;
  }

  if (isLegacyTarget(targetFile, context)) {
    return true;
  }

  if (activeHints.length > 0 && !activeHints.includes(targetFile)) {
    return true;
  }

  return false;
}

export async function reviewArchitectureTask(
  task: ArchitectureReviewTask,
  options?: {
    repoContext?: RepoContext;
    runtimeMemory?: RuntimeMemory;
  }
) {
  const [context, memory] = await Promise.all([
    options?.repoContext ? Promise.resolve(options.repoContext) : readRepoContext(),
    options?.runtimeMemory ? Promise.resolve(options.runtimeMemory) : readRuntimeMemoryFile().then((result) => result.memory),
  ]);

  const signals: ArchitectureReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const isRuntime = isRuntimeArea(targetFile);
  const isLegacy = isLegacyTarget(targetFile, context);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (isRuntime ? 1 : 0);

  if (!targetFile) {
    signals.push({
      code: "missing-target",
      severity: "high",
      detail: "Task is missing a target file.",
    });
    score += 4;
  }

  if (isLegacy) {
    signals.push({
      code: "legacy-target",
      severity: "high",
      detail: `Target file is in a legacy or deprecated zone: ${targetFile}`,
    });
    score += 3;
  }

  if (isRuntime) {
    signals.push({
      code: "runtime-target",
      severity: "medium",
      detail: `Target touches runtime or orchestration code: ${targetFile}`,
    });
    score += 2;
  }

  if (riskyHits > 1) {
    signals.push({
      code: "repeated-risk",
      severity: "high",
      detail: `Target file has been flagged risky ${riskyHits} times.`,
    });
    score += 3;
  } else if (riskyHits === 1) {
    signals.push({
      code: "known-risk",
      severity: "medium",
      detail: `Target file has been flagged risky before.`,
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
    score += 2;
  }

  if (scopeSize >= 4) {
    signals.push({
      code: "oversized-scope",
      severity: "medium",
      detail: `Scope size is ${scopeSize}, which is larger than a simple single-file change.`,
    });
    score += 2;
  }

  if (isUnsafeOrMissingTarget(targetFile, context)) {
    signals.push({
      code: "unsafe-target",
      severity: "high",
      detail: `Target file does not fit the active architecture hints: ${targetFile || "(missing)"}`,
    });
    score += 2;
  }

  let recommendation: ArchitectureReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || isLegacy || riskyHits > 1 || (task.executionMode === "multi-step" && score >= 5)) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (isRuntime || riskyHits === 1 || dependencyCount > 0 || blockedCount > 0) {
    recommendation = previewOnly ? "previewOnly" : "requiresApproval";
    requiresApproval = true;
    previewOnly = previewOnly || scopeSize >= 3;
  } else if (scopeSize >= 4) {
    recommendation = "requiresApproval";
    requiresApproval = true;
  }

  if (recommendation === "previewOnly") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "requiresApproval") {
    requiresApproval = true;
  }

  await logActivity({
    type: "architecture-review-completed",
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
  } satisfies ArchitectureReviewResult;
}

export function applyArchitectureReview(
  task: ArchitectureReviewTask,
  review: ArchitectureReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Architecture review: ${review.recommendation} (scope ${review.scopeSize}).`;

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
