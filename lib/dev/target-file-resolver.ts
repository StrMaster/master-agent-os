import { canAutonomouslyPatch, getFileRole, getProjectContextSummary, isHighRiskFile } from "./project-context";

export type TargetFileDecision = {
  requestedPrompt: string;
  targetFile: string;
  confidence: "low" | "medium" | "high";
  reason: string;
  warnings: string[];
  projectContext: string;
};

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase();
}

function choosePreferredTarget(prompt: string): { targetFile: string; reason: string; confidence: TargetFileDecision["confidence"] } {
  const text = normalizePrompt(prompt);

  if (hasAny(text, ["layout", "global nav", "navigation shell", "metadata", "provider", "html", "body"])) {
    return {
      targetFile: "app/layout.tsx",
      confidence: "medium",
      reason: "Prompt explicitly mentions global layout, navigation shell, metadata, providers, html or body.",
    };
  }

  if (hasAny(text, ["dashboard", "home page", "homepage", "main page", "overview", "landing dashboard"])) {
    return {
      targetFile: "app/page.tsx",
      confidence: "high",
      reason: "Prompt asks for dashboard/home UI, so the main dashboard page is the safest target.",
    };
  }

  if (hasAny(text, ["task", "tasks", "queue", "wave", "queued", "pending task"])) {
    return {
      targetFile: "app/tasks/page.tsx",
      confidence: "high",
      reason: "Prompt asks about task or queue UI, so the tasks page is the safest target.",
    };
  }

  if (hasAny(text, ["execution", "runner status", "activity", "logs", "run history", "timeline"])) {
    return {
      targetFile: "app/execution/page.tsx",
      confidence: "high",
      reason: "Prompt asks about execution/runner visibility, so the execution page is the safest target.",
    };
  }

  if (hasAny(text, ["agent", "agents", "registry", "specialist", "business agent", "core agent"])) {
    return {
      targetFile: "app/agents/page.tsx",
      confidence: "medium",
      reason: "Prompt asks about agents or registry UI, so the agents page is a likely safe target.",
    };
  }

  if (hasAny(text, ["business", "seo", "marketing", "website audit", "client report", "offer", "proposal", "outreach"])) {
    return {
      targetFile: "agents/business",
      confidence: "medium",
      reason: "Prompt asks about business intelligence, so the business agent layer is the likely target area.",
    };
  }

  if (hasAny(text, ["api", "endpoint", "route", "backend", "server", "supabase", "anthropic", "openai"])) {
    return {
      targetFile: "app/api/master-agent/route.ts",
      confidence: "low",
      reason: "Prompt appears backend/API related, but API files are high risk and require explicit confirmation/validation.",
    };
  }

  if (hasAny(text, ["runner", "merge", "patch", "validation", "repair", "build", "pr-only", "auto run", "autorun"])) {
    return {
      targetFile: "app/api/agent-runner/route.ts",
      confidence: "low",
      reason: "Prompt appears runner related, but the runner is critical and should only be patched with a focused task.",
    };
  }

  return {
    targetFile: "app/page.tsx",
    confidence: "low",
    reason: "No clear target detected. Defaulting to main dashboard UI as the safest visible surface.",
  };
}

export function resolveTargetFile(prompt: string): TargetFileDecision {
  const preferred = choosePreferredTarget(prompt);
  const role = getFileRole(preferred.targetFile);
  const warnings: string[] = [];

  if (isHighRiskFile(preferred.targetFile)) {
    warnings.push(`${preferred.targetFile} is high risk: ${role.notes.join(" ")}`);
  }

  if (!canAutonomouslyPatch(preferred.targetFile)) {
    warnings.push(`${preferred.targetFile} should not be autonomously patched unless the task explicitly requires it.`);
  }

  if (preferred.targetFile === "app/layout.tsx" && !hasAny(normalizePrompt(prompt), ["layout", "metadata", "provider", "html", "body", "global nav"])) {
    warnings.push("Generic UI tasks must not target app/layout.tsx.");
  }

  return {
    requestedPrompt: prompt,
    targetFile: preferred.targetFile,
    confidence: preferred.confidence,
    reason: preferred.reason,
    warnings,
    projectContext: getProjectContextSummary(),
  };
}

export function shouldBlockAutonomousPatch(prompt: string, targetFile: string): { blocked: boolean; reason: string } {
  const text = normalizePrompt(prompt);
  const role = getFileRole(targetFile);

  if (targetFile === "app/layout.tsx" && !hasAny(text, ["layout", "metadata", "provider", "html", "body", "global nav"])) {
    return {
      blocked: true,
      reason: "Blocked: app/layout.tsx is high-risk and should not be used for generic UI/dashboard polish tasks.",
    };
  }

  if (role.risk === "high" && !hasAny(text, ["runner", "api", "route", "layout", "metadata", "provider", "critical", "fix build"])) {
    return {
      blocked: true,
      reason: `Blocked: ${targetFile} is high-risk and the prompt does not explicitly require this file.`,
    };
  }

  return { blocked: false, reason: "Target file is acceptable for this task." };
}
