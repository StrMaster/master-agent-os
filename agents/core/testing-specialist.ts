import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type TestingReviewRecommendation =
  | "approve"
  | "build-verification"
  | "additional-validation"
  | "requiresApproval"
  | "split"
  | "execution-caution"
  | "deploy-caution";

export type TestingReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type TestingReviewResult = {
  recommendation: TestingReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: TestingReviewSignal[];
};

export type TestingReviewTask = {
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

const TESTING_HINTS = [
  "test",
  "testing",
  "validation",
  "verify",
  "verification",
  "coverage",
  "regression",
  "qa",
  "build",
  "lint",
  "deploy",
  "release",
];

function countList(value?: string[]) {
  return Array.isArray(value) ? value.length : 0;
}

function countRiskHits(memory: RuntimeMemory, targetFile: string) {
  return (
    memory.riskyFiles?.find((entry) => entry.targetFile === targetFile)?.hits ?? 0
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

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

function hasTestingIntent(task: TestingReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return TESTING_HINTS.some((hint) => haystack.includes(hint));
}

export function shouldReviewTestingTask(
  task: TestingReviewTask,
  context?: RepoContext
) {
  const targetFile = String(task.targetFile ?? "").trim();

  if (!targetFile) {
    return false;
  }

  if (context) {
    const activeHints = getActiveFileHints(context);
    if (activeHints.includes(targetFile)) {
      return true;
    }
  }

  return hasTestingIntent(task);
}

export async function reviewTestingTask(
  task: TestingReviewTask,
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

  const signals: TestingReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const frontendTarget = isFrontendTarget(targetFile, context);
  const runtimeOrBackend = isRuntimeOrBackendTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const isDeploySensitive =
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/merge-pr/") ||
    targetFile.startsWith("app/api/validate-pr/") ||
    targetFile.startsWith("app/api/recovery-");
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (frontendTarget ? 1 : 0) +
    (runtimeOrBackend ? 2 : 0);

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
    score += 3;
  }

  if (isDeploySensitive) {
    signals.push({
      code: "deploy-sensitive",
      severity: "high",
      detail: `Target can affect deploy or merge safety: ${targetFile}`,
    });
    score += 2;
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
      detail: `Scope size is ${scopeSize}, which suggests extra validation.`,
    });
    score += 2;
  }

  const testingIntent = hasTestingIntent(task);

  if (testingIntent) {
    signals.push({
      code: "testing-intent",
      severity: "low",
      detail: "Task already references validation or testing concerns.",
    });
  }

  let recommendation: TestingReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || legacyTarget) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (runtimeOrBackend || isDeploySensitive || riskyHits > 1) {
    recommendation = "deploy-caution";
    previewOnly = true;
    requiresApproval = true;
  } else if (score >= 4 || dependencyCount > 1 || blockedCount > 0 || task.executionMode === "multi-step") {
    recommendation = "execution-caution";
    previewOnly = true;
    requiresApproval = true;
  } else if (frontendTarget && score >= 2) {
    recommendation = "additional-validation";
    previewOnly = true;
    requiresApproval = true;
  } else if (testingIntent || score >= 1) {
    recommendation = "build-verification";
  }

  if (recommendation === "build-verification") {
    previewOnly = previewOnly || false;
  }

  if (recommendation === "additional-validation") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "execution-caution") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "deploy-caution") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "split") {
    previewOnly = true;
    requiresApproval = true;
  }

  await logActivity({
    type: "testing-review-completed",
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
  } satisfies TestingReviewResult;
}

export function applyTestingReview(
  task: TestingReviewTask,
  review: TestingReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Testing review: ${review.recommendation} (scope ${review.scopeSize}).`;

  return {
    ...task,
    previewOnly: review.previewOnly || task.previewOnly === true,
    requiresApproval: review.requiresApproval || task.requiresApproval === true,
    riskLevel:
      review.recommendation === "approve" || review.recommendation === "build-verification"
        ? task.riskLevel
        : "high",
    plannerNotes: existingNotes
      ? `${existingNotes} ${reviewNote}`
      : reviewNote,
  };
}
