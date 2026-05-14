export type ReviewRuleResult = {
  passed: boolean;
  reason?: string;
};

export function reviewUiIntentPatch({
  prompt,
  patchedContent,
}: {
  prompt: string;
  patchedContent: string;
}): ReviewRuleResult {
  const text = prompt.toLowerCase();

  // Spacing task — no empty spacer divs
  const isSpacingTask =
    text.includes("spacing") ||
    text.includes("tarp") ||
    text.includes("gap") ||
    text.includes("mygtuk") ||
    text.includes("button");

  if (isSpacingTask) {
    const addedEmptySpacer =
      patchedContent.includes("<div style={{ height:") ||
      patchedContent.includes("<div className=\"h-") ||
      patchedContent.includes("<div className='h-");

    if (addedEmptySpacer) {
      return {
        passed: false,
        reason: "UI spacing task appears to use an empty spacer div. Prefer gap, margin, flex spacing, or wrapping the target button.",
      };
    }
  }

  // Never write to .agent/ files directly
  if (
    patchedContent.includes(".agent/tasks.json") ||
    patchedContent.includes(".agent/state.json") ||
    patchedContent.includes(".agent/memory.json")
  ) {
    return {
      passed: false,
      reason: "Patch attempts to write directly to .agent/ runtime files. Use the API layer instead.",
    };
  }

  // No hardcoded secrets or tokens
  if (
    /process\.env\.[A-Z_]+\s*=\s*["']/.test(patchedContent) ||
    /GITHUB_TOKEN\s*=\s*["']/.test(patchedContent) ||
    /ANTHROPIC_API_KEY\s*=\s*["']/.test(patchedContent)
  ) {
    return {
      passed: false,
      reason: "Patch appears to hardcode a secret or API key. Use environment variables instead.",
    };
  }

  // No console.log left in API routes
  const isApiRoute = text.includes("api/") || text.includes("route.ts") || text.includes("backend");
  if (isApiRoute && patchedContent.includes("console.log(")) {
    return {
      passed: false,
      reason: "API route patch contains console.log. Use console.warn or remove debug logging.",
    };
  }

  // No direct import of openai in new code (system uses Claude Haiku)
  if (
    patchedContent.includes("from \"openai\"") ||
    patchedContent.includes("from 'openai'")
  ) {
    return {
      passed: false,
      reason: "Patch imports OpenAI directly. System uses Anthropic Claude — use @anthropic-ai/sdk instead.",
    };
  }

  // No broad file rewrites — patch should not contain more than 150 lines
  const lineCount = patchedContent.split("\n").length;
  if (lineCount > 400) {
    return {
      passed: false,
      reason: `Patch is ${lineCount} lines — too broad. Keep changes minimal and surgical.`,
    };
  }

  return { passed: true };
}
