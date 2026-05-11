import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import { logActivity } from "@/app/api/agent-runner/activity";
import {
  getActiveFileHints,
  getLegacyFileHints,
  readRepoContext,
} from "./repo-context";
import type { RepoContext } from "./repo-context";

export type SecurityReviewRecommendation =
  | "approve"
  | "security-review"
  | "requiresApproval"
  | "execution-caution"
  | "deploy-caution"
  | "split"
  | "avoid-risky-runtime-modification";

export type SecurityReviewSignal = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

export type SecurityReviewResult = {
  recommendation: SecurityReviewRecommendation;
  previewOnly: boolean;
  requiresApproval: boolean;
  shouldSplit: boolean;
  scopeSize: number;
  signals: SecurityReviewSignal[];
};

export type SecurityReviewTask = {
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

const SECURITY_HINTS = [
  "security",
  "secret",
  "token",
  "env",
  "permission",
  "auth",
  "authorization",
  "csrf",
  "xss",
  "csp",
  "oauth",
  "jwt",
  "credential",
  "exposure",
  "external request",
  "webhook",
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

function isSensitiveRuntimeTarget(targetFile: string) {
  return (
    targetFile.startsWith("app/api/agent-runner/") ||
    targetFile.startsWith("app/api/auto-run/") ||
    targetFile.startsWith("app/api/control-state/") ||
    targetFile.startsWith("app/api/deploy-status/") ||
    targetFile.startsWith("app/api/approve-") ||
    targetFile.startsWith("app/api/recovery-") ||
    targetFile.startsWith("app/api/merge-pr/")
  );
}

function isLegacyTarget(targetFile: string, context: RepoContext) {
  return getLegacyFileHints(context).some(
    (hint) => targetFile.includes(hint) || hint.includes(targetFile)
  );
}

function hasSecurityIntent(task: SecurityReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes, task.targetFile]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return SECURITY_HINTS.some((hint) => haystack.includes(hint));
}

function hasUnsafeEnvPatterns(task: SecurityReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "process.env",
    "env var",
    "environment variable",
    "secret",
    "token",
    "credential",
  ].some((hint) => haystack.includes(hint));
}

function hasUnsafeExternalRequests(task: SecurityReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "fetch",
    "axios",
    "webhook",
    "external request",
    "third-party",
    "callback",
    "request",
  ].some((hint) => haystack.includes(hint));
}

function hasRiskyPermissionPatterns(task: SecurityReviewTask) {
  const haystack = [task.title, task.summary, task.plannerNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["permission", "authorization", "admin", "read/write", "scope"].some(
    (hint) => haystack.includes(hint)
  );
}

export function shouldReviewSecurityTask(
  task: SecurityReviewTask,
  context?: RepoContext
) {
  const targetFile = String(task.targetFile ?? "").trim();

  if (!targetFile) {
    return hasSecurityIntent(task);
  }

  if (context) {
    const activeHints = getActiveFileHints(context);
    if (activeHints.includes(targetFile) && isSensitiveRuntimeTarget(targetFile)) {
      return true;
    }
  }

  return isSensitiveRuntimeTarget(targetFile) || hasSecurityIntent(task);
}

export async function reviewSecurityTask(
  task: SecurityReviewTask,
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

  const signals: SecurityReviewSignal[] = [];
  let score = 0;

  const targetFile = String(task.targetFile ?? "").trim();
  const runtimeOrBackend = isRuntimeOrBackendTarget(targetFile);
  const sensitiveRuntime = isSensitiveRuntimeTarget(targetFile);
  const legacyTarget = isLegacyTarget(targetFile, context);
  const riskyHits = countRiskHits(memory, targetFile);
  const dependencyCount = countList(task.dependsOnTaskIds);
  const blockedCount = countList(task.blockedBy);
  const unsafeEnv = hasUnsafeEnvPatterns(task);
  const unsafeExternalRequests = hasUnsafeExternalRequests(task);
  const riskyPermissions = hasRiskyPermissionPatterns(task);
  const securityIntent = hasSecurityIntent(task);
  const scopeSize =
    1 +
    dependencyCount +
    blockedCount +
    (task.executionMode === "multi-step" ? 2 : 0) +
    (task.wave && task.wave > 1 ? 1 : 0) +
    (runtimeOrBackend ? 2 : 0) +
    (unsafeEnv ? 1 : 0) +
    (unsafeExternalRequests ? 1 : 0) +
    (riskyPermissions ? 1 : 0);

  if (securityIntent) {
    signals.push({
      code: "security-intent",
      severity: "low",
      detail: "Task explicitly references security or runtime safety concerns.",
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

  if (sensitiveRuntime) {
    signals.push({
      code: "sensitive-runtime",
      severity: "high",
      detail: `Target touches a security-sensitive runtime surface: ${targetFile}`,
    });
    score += 3;
  }

  if (unsafeEnv) {
    signals.push({
      code: "unsafe-env",
      severity: "high",
      detail: "Task appears to touch environment variables, tokens, or secrets.",
    });
    score += 3;
  }

  if (unsafeExternalRequests) {
    signals.push({
      code: "external-request",
      severity: "medium",
      detail: "Task appears to introduce or modify external request behavior.",
    });
    score += 1;
  }

  if (riskyPermissions) {
    signals.push({
      code: "permission-risk",
      severity: "medium",
      detail: "Task appears to touch permissions or authorization patterns.",
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
      detail: `Scope size is ${scopeSize}, which suggests extra security validation.`,
    });
    score += 2;
  }

  let recommendation: SecurityReviewRecommendation = "approve";
  let previewOnly = Boolean(task.previewOnly);
  let requiresApproval = Boolean(task.requiresApproval);
  let shouldSplit = false;

  if (!targetFile || legacyTarget || sensitiveRuntime) {
    recommendation = "avoid-risky-runtime-modification";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (scopeSize >= 6 || dependencyCount > 2 || blockedCount > 1) {
    recommendation = "split";
    previewOnly = true;
    requiresApproval = true;
    shouldSplit = true;
  } else if (unsafeEnv || riskyPermissions || riskyHits > 1 || scopeSize >= 5) {
    recommendation = "security-review";
    previewOnly = true;
    requiresApproval = true;
  } else if (runtimeOrBackend || unsafeExternalRequests || dependencyCount > 0 || blockedCount > 0) {
    recommendation = "execution-caution";
    previewOnly = true;
    requiresApproval = true;
  } else if (score >= 2) {
    recommendation = "deploy-caution";
    previewOnly = true;
    requiresApproval = true;
  }

  if (recommendation === "security-review") {
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

  if (recommendation === "avoid-risky-runtime-modification") {
    previewOnly = true;
    requiresApproval = true;
  }

  await logActivity({
    type: "security-review-completed",
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
  } satisfies SecurityReviewResult;
}

export function applySecurityReview(
  task: SecurityReviewTask,
  review: SecurityReviewResult
) {
  const existingNotes = String(task.plannerNotes ?? "").trim();
  const reviewNote = `Security review: ${review.recommendation} (scope ${review.scopeSize}).`;

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
