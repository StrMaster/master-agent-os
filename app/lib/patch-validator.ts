export function validatePatch(content: string) {
  const issues: string[] = [];

  if (!content.trim()) {
    issues.push("Generated patch is empty");
  }

  if (content.includes("```")) {
    issues.push("Patch contains markdown code fences");
  }

  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    issues.push("Brace count mismatch");
  }

  const openParens = (content.match(/$begin:math:text$\/g\) \|\| \[\]\)\.length\;
  const closeParens \= \(content\.match\(\/$end:math:text$/g) || []).length;

  if (openParens !== closeParens) {
    issues.push("Parenthesis mismatch");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}