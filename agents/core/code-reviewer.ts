import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type CodeReviewRecommendation =
  | "approve"
  | "previewOnly"
  | "requiresApproval"
  | "split"
  | "merge-caution"
  | "execution-caution";

export type CodeReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type CodeReviewResult = {
  recommendation: CodeReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  mergeCaution: boolean;
  executionCaution: boolean;
  scopeSize: number;
  signals: CodeReviewSignal[];
};

export type CodeReviewTask = {
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

function hasLegacyReference(task: CodeReviewTask, context: RepoContext) {
  const legacyHints = getLegacyFileHints(context);
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return legacyHints.some((hint) => haystack.includes(hint.toLowerCase()));
}

export async function reviewCodeTask(
  task: CodeReviewTask,
  options?: {
    repoContext?: RepoContext;
    runtimeMemory?: RuntimeMemory;
  }
) {
  const [context, memory] = await Promise.all([
    options?.repoContext ? Promise.resolve(options.repoContext) : readRepoContext(),
    options?.runtimeMemory ? Promise.resolve(options.runtimeMemory) : readRuntimeMemoryFile().then((result) => result.memory),
  ]);

  const signals: CodeReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const activeHints = getActiveFileHints(context);
  const isRuntime = isRuntimeArea(targetFile);
  const isLegacy = isLegacyTarget(targetFile, context) || hasLegacyReference(task, context);
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

  if (scopeSize >= 5) {
    signals.push({
      code: "oversized-change",
      severity: "high",
      detail: `Change scope is ${scopeSize}, which suggests a split is safer.`,
    });
    score += 3;
  } else if (scopeSize >= 3) {
    signals.push({
      code: "moderate-scope",
      severity: "medium",
      detail: `Change scope is ${scopeSize}.`,
    });
    score += 1;
  }

  if (isRuntime) {
    signals.push({
      code: "runtime-edit",
      severity: "high",
      detail: `Target touches runtime or orchestration code: ${targetFile}`,
    });
    score += 2;
  }

  if (activeHints.length > 0 && !activeHints.includes(targetFile)) {
    signals.push({
      code: "unmapped-target",
      severity: "medium",
      detail: `Target file is not in the active repo context hints: ${targetFile}`,
    });
    score += 1;
  }

  if (isLegacy) {
    signals.push({
      code: "legacy-reference",
      severity: "high",
      detail: `Task references a legacy or deprecated area: ${targetFile}`,
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

  if (dependencyCount > 1) {
    signals.push({
      code: "cross-module",
      severity: "medium",
      detail: `${dependencyCount} dependency links suggest cross-module change risk.`,
    });
    score += 2;
  }

  if (blockedCount > 0) {
    signals.push({
      code: "blocked-by",
      severity: "medium",
      detail: `${blockedCount} blocking reference${blockedCount === 1 ? "" : "s"} present.`,
    });
    score += 1;
  }

  if (String(task.riskLevel ?? "").toLowerCase() === "high") {
    signals.push({
      code: "high-risk-level",
      severity: "medium",
      detail: "Task is already marked high risk.",
    });
    score += 1;
  }

  if (!String(task.summary ?? "").trim()) {
    signals.push({
      code: "missing-summary",
      severity: "medium",
      detail: "Task summary is missing or empty.",
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

  const mergeCaution =
    isRuntime || riskyHits > 0 || dependencyCount > 0 || blockedCount > 0 || score >= 3;
  const executionCaution =
    isRuntime || riskyHits > 0 || isLegacy || score >= 2 || task.executionMode === "multi-step";

  let recommendation: CodeReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || isLegacy || riskyHits > 1 || scopeSize >= 6) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (executionCaution && !requiresApproval) {
    recommendation = "execution-caution";
    requiresApproval = true;
    previewOnly = previewOnly || scopeSize >= 4;
  } else if (mergeCaution && !requiresApproval) {
    recommendation = "merge-caution";
    requiresApproval = true;
  } else if (score >= 2) {
    recommendation = previewOnly ? "previewOnly" : "requiresApproval";
    requiresApproval = true;
    previewOnly = previewOnly || scopeSize >= 4;
  }

  if (recommendation === "previewOnly") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "requiresApproval") {
    requiresApproval = true;
  }

  await logActivity({
    type: "code-review-completed",
    taskId: task.id,
    targetFile,
    recommendation,
    scopeSize,
    previewOnly,
    requiresApproval,
    shouldSplit,
    mergeCaution,
    executionCaution,
    signals: JSON.stringify(signals.slice(0, 8)),
  }).catch(() => {});

  return {
    recommendation,
    previewOnly,
    requiresApproval,
    shouldSplit,
    mergeCaution,
    executionCaution,
    scopeSize,
    signals,
  } satisfies CodeReviewResult;
}

export function applyCodeReview(task: CodeReviewTask, review: CodeReviewResult) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Code review: ${review.recommendation} (scope ${review.scopeSize}).`;

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
