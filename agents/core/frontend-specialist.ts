import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type FrontendReviewRecommendation =
  | "approve"
  | "small-frontend-task"
  | "requiresApproval"
  | "split"
  | "design-review"
  | "avoid-runtime-files";

export type FrontendReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type FrontendReviewResult = {
  recommendation: FrontendReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: FrontendReviewSignal[];
};

export type FrontendReviewTask = {
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

const VISUAL_ONLY_HINTS = [
  "visual",
  "ui",
  "layout",
  "design",
  "spacing",
  "responsive",
  "style",
  "polish",
  "button",
  "card",
  "copy",
  "theme",
];

const LOGIC_HINTS = [
  "state",
  "data",
  "fetch",
  "api",
  "runtime",
  "store",
  "context",
  "hook",
  "auth",
  "flow",
  "approval",
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

  if (normalized.startsWith("app/api/") || normalized.startsWith("agents/")) {
    return false;
  }

  if ((context.frontendFiles ?? []).includes(normalized)) {
    return true;
  }

  return (
    normalized.startsWith("app/components/") ||
    normalized === "app/page.tsx" ||
    normalized.startsWith("app/execution/") ||
    normalized.startsWith("app/tasks/")
  );
}

function isRuntimeCoupledTarget(targetFile: string) {
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

function hasFrontendIntent(task: FrontendReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return VISUAL_ONLY_HINTS.concat(LOGIC_HINTS).some((hint) =>
    haystack.includes(hint)
  );
}

function isVisualOnly(task: FrontendReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return VISUAL_ONLY_HINTS.some((hint) => haystack.includes(hint));
}

function isLogicAffecting(task: FrontendReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return LOGIC_HINTS.some((hint) => haystack.includes(hint));
}

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

export async function reviewFrontendTask(
  task: FrontendReviewTask,
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

  const signals: FrontendReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const runtimeCoupled = isRuntimeCoupledTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const frontendTarget = isFrontendTarget(targetFile, context);
  const frontendIntent = frontendTarget || hasFrontendIntent(task);
  const visualOnly = isVisualOnly(task);
  const logicAffecting = isLogicAffecting(task);
  const riskyHits = countRiskHits(memory, targetFile);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (logicAffecting ? 1 : 0) +
    (runtimeCoupled ? 2 : 0);

  if (frontendIntent) {
    signals.push({
      code: "frontend-surface",
      severity: "low",
      detail: frontendTarget
        ? `Target is in a known frontend surface: ${targetFile}`
        : `Task appears frontend-related: ${targetFile || "(missing)"}`,
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

  if (!frontendIntent && targetFile) {
    signals.push({
      code: "not-frontend",
      severity: "low",
      detail: `Task does not appear to be a frontend change: ${targetFile}`,
    });
  }

  if (visualOnly) {
    signals.push({
      code: "visual-only",
      severity: "low",
      detail: "Task appears to be visual-only or presentation-focused.",
    });
  }

  if (logicAffecting) {
    signals.push({
      code: "logic-affecting",
      severity: "medium",
      detail: "Task touches state, data, or other logic-bearing frontend behavior.",
    });
    score += 2;
  }

  if (runtimeCoupled) {
    signals.push({
      code: "runtime-coupled",
      severity: "high",
      detail: `Target touches runtime or orchestration code: ${targetFile}`,
    });
    score += 3;
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
      detail: `Scope size is ${scopeSize}, which suggests splitting the frontend work.`,
    });
    score += 2;
  }

  let recommendation: FrontendReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || runtimeCoupled || legacyTarget) {
    recommendation = "avoid-runtime-files";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = runtimeCoupled || scopeSize >= 4;
  } else if (!frontendIntent) {
    recommendation = score >= 2 ? "requiresApproval" : "approve";
    if (recommendation === "requiresApproval") {
      requiresApproval = true;
      previewOnly = true;
    }
  } else if (scopeSize >= 5) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (logicAffecting || dependencyCount > 0 || blockedCount > 0 || riskyHits > 0) {
    recommendation = "design-review";
    previewOnly = true;
    requiresApproval = true;
  } else if (visualOnly && scopeSize <= 2) {
    recommendation = "small-frontend-task";
  } else if (score >= 2) {
    recommendation = "requiresApproval";
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "split") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "design-review") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "avoid-runtime-files") {
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "requiresApproval") {
    requiresApproval = true;
  }

  await logActivity({
    type: "frontend-review-completed",
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
  } satisfies FrontendReviewResult;
}

export function applyFrontendReview(
  task: FrontendReviewTask,
  review: FrontendReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Frontend review: ${review.recommendation} (scope ${review.scopeSize}).`;

  return {
    ...task,
    previewOnly: review.previewOnly || task.previewOnly === true,
    requiresApproval: review.requiresApproval || task.requiresApproval === true,
    riskLevel:
      review.recommendation === "approve" || review.recommendation === "small-frontend-task"
        ? task.riskLevel
        : "high",
    plannerNotes: existingNotes
      ? `${existingNotes} ${reviewNote}`
      : reviewNote,
  };
}
