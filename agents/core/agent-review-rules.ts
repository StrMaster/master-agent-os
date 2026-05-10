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

  const isSpacingTask =
    text.includes("spacing") ||
    text.includes("tarp") ||
    text.includes("gap") ||
    text.includes("mygtuk") ||
    text.includes("button");

  if (!isSpacingTask) {
    return { passed: true };
  }

  const addedEmptySpacer =
    patchedContent.includes("<div style={{ height:") ||
    patchedContent.includes("<div className=\"h-") ||
    patchedContent.includes("<div className='h-");

  if (addedEmptySpacer) {
    return {
      passed: false,
      reason:
        "UI spacing task appears to use an empty spacer div. Prefer gap, margin, flex spacing, or wrapping the target button.",
    };
  }

  return { passed: true };
}