export type PatchIssueType =
  | "jsx-tag-mismatch"
  | "jsx-unclosed-tags"
  | "typescript-error"
  | "build-error"
  | "unknown";

export type PatchIssue = {
  type: PatchIssueType;
  message: string;
  file: string;
};

export type PatchRepairDecision = {
  shouldRetry: boolean;
  nextAttempt: number;
  issues: PatchIssue[];
  repairInstructions: string;
  stopReason?: string;
};

export type PatchRepairInput = {
  taskPrompt: string;
  targetFile: string;
  validationOutput: string;
  attempt: number;
  maxAttempts?: number;
};

function includesAny(source: string, terms: string[]): boolean {
  return terms.some((term) => source.includes(term));
}

export function detectPatchIssues(validationOutput: string, targetFile: string): PatchIssue[] {
  const output = validationOutput.toLowerCase();
  const issues: PatchIssue[] = [];

  if (includesAny(output, ["jsx tag mismatch", "expected </", "before </"])) {
    issues.push({
      type: "jsx-tag-mismatch",
      file: targetFile,
      message: "JSX nesting or closing tag order is invalid.",
    });
  }

  if (includesAny(output, ["unclosed tag", "unclosed tags"])) {
    issues.push({
      type: "jsx-unclosed-tags",
      file: targetFile,
      message: "One or more JSX tags are not closed correctly.",
    });
  }

  if (includesAny(output, ["type error", "typescript", "failed to type check"])) {
    issues.push({
      type: "typescript-error",
      file: targetFile,
      message: "TypeScript validation failed.",
    });
  }

  if (includesAny(output, ["failed to compile", "next build", "build failed"])) {
    issues.push({
      type: "build-error",
      file: targetFile,
      message: "Build validation failed.",
    });
  }

  if (issues.length === 0) {
    issues.push({
      type: "unknown",
      file: targetFile,
      message: validationOutput.slice(0, 500) || "Unknown validation failure.",
    });
  }

  return issues;
}

export function createPatchRepairDecision(input: PatchRepairInput): PatchRepairDecision {
  const maxAttempts = input.maxAttempts ?? 2;
  const issues = detectPatchIssues(input.validationOutput, input.targetFile);

  if (input.attempt >= maxAttempts) {
    return {
      shouldRetry: false,
      nextAttempt: input.attempt,
      issues,
      repairInstructions: "",
      stopReason: `Maximum patch repair attempts reached: ${maxAttempts}.`,
    };
  }

  return {
    shouldRetry: true,
    nextAttempt: input.attempt + 1,
    issues,
    repairInstructions: [
      "Repair the previous patch using the existing file structure.",
      "Keep the change small and focused on the original task.",
      "Preserve valid JSX/TSX nesting, imports, props and component boundaries.",
      "Use the validation output as the source of truth for what failed.",
      `Original task: ${input.taskPrompt}`,
      `Target file: ${input.targetFile}`,
      "Detected issues:",
      ...issues.map((issue) => `- ${issue.type}: ${issue.message}`),
      "Validation output:",
      input.validationOutput.slice(0, 3000),
    ].join("\n"),
  };
}
