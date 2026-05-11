import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type DesignReviewRecommendation =
  | "approve"
  | "small-design-task"
  | "design-review"
  | "requiresApproval"
  | "split"
  | "avoid-runtime-backend-changes";

export type DesignReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type DesignReviewResult = {
  recommendation: DesignReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: DesignReviewSignal[];
};

export type DesignReviewTask = {
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

const DESIGN_SURFACE_HINTS = [
  "design",
  "ui",
  "ux",
  "visual",
  "layout",
  "spacing",
  "responsive",
  "mobile",
  "accessibility",
  "a11y",
  "contrast",
  "aria",
  "keyboard",
  "focus",
  "usability",
  "polish",
  "style",
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

function isDesignSurface(targetFile: string, context: RepoContext) {
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

function hasDesignIntent(task: DesignReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return DESIGN_SURFACE_HINTS.some((hint) => haystack.includes(hint));
}

function isVisualOnly(task: DesignReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["visual", "ui", "ux", "layout", "style", "polish", "responsive"].some(
    (hint) => haystack.includes(hint)
  );
}

function isLogicAffecting(task: DesignReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return LOGIC_HINTS.some((hint) => haystack.includes(hint));
}

function hasAccessibilitySignals(task: DesignReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["accessibility", "a11y", "aria", "keyboard", "focus", "contrast"].some(
    (hint) => haystack.includes(hint)
  );
}

export function shouldReviewDesignTask(
  task: DesignReviewTask,
  context?: RepoContext
) {
  const targetFile = String(task.targetFile ?? "").trim();

  if (targetFile && context && isDesignSurface(targetFile, context)) {
    return true;
  }

  return hasDesignIntent(task);
}

export async function reviewDesignTask(
  task: DesignReviewTask,
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

  const signals: DesignReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const designSurface = isDesignSurface(targetFile, context);
  const runtimeOrBackend = isRuntimeOrBackendTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const visualOnly = isVisualOnly(task);
  const logicAffecting = isLogicAffecting(task);
  const accessibilitySignals = hasAccessibilitySignals(task);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (designSurface ? 1 : 0) +
    (accessibilitySignals ? 1 : 0) +
    (logicAffecting ? 1 : 0);

  if (designSurface) {
    signals.push({
      code: "design-surface",
      severity: "low",
      detail: `Target is a UI surface: ${targetFile}`,
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
      detail: "Task touches state, data, or other logic-bearing UI behavior.",
    });
    score += 2;
  }

  if (accessibilitySignals) {
    signals.push({
      code: "accessibility",
      severity: "medium",
      detail: "Task includes accessibility-related concerns or hints.",
    });
    score += 1;
  } else if (designSurface) {
    signals.push({
      code: "accessibility-basics",
      severity: "low",
      detail: "Design surface should keep keyboard, contrast, and focus behavior in mind.",
    });
  }

  if (runtimeOrBackend) {
    signals.push({
      code: "runtime-backend",
      severity: "high",
      detail: `Target touches runtime or backend code: ${targetFile}`,
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
      detail: `Scope size is ${scopeSize}, which suggests splitting the design work.`,
    });
    score += 2;
  }

  let recommendation: DesignReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || runtimeOrBackend || legacyTarget) {
    recommendation = "avoid-runtime-backend-changes";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (scopeSize >= 5) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (logicAffecting || riskyHits > 0 || dependencyCount > 0 || blockedCount > 0) {
    recommendation = "design-review";
    previewOnly = true;
    requiresApproval = true;
  } else if (visualOnly && scopeSize <= 2) {
    recommendation = "small-design-task";
  } else if (accessibilitySignals || score >= 2) {
    recommendation = "requiresApproval";
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "design-review") {
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

  if (recommendation === "avoid-runtime-backend-changes") {
    previewOnly = true;
    requiresApproval = true;
  }

  await logActivity({
    type: "design-review-completed",
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
  } satisfies DesignReviewResult;
}

export function applyDesignReview(task: DesignReviewTask, review: DesignReviewResult) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Design review: ${review.recommendation} (scope ${review.scopeSize}).`;

  return {
    ...task,
    previewOnly: review.previewOnly || task.previewOnly === true,
    requiresApproval: review.requiresApproval || task.requiresApproval === true,
    riskLevel:
      review.recommendation === "approve" || review.recommendation === "small-design-task"
        ? task.riskLevel
        : "high",
    plannerNotes: existingNotes
      ? `${existingNotes} ${reviewNote}`
      : reviewNote,
  };
}
