function countChar(content: string, char: string) {
  return content.split(char).length - 1;
}

export function validatePatch(content: string) {
  const issues: string[] = [];

  if (!content.trim()) {
    issues.push("Generated patch is empty");
  }

  if (content.includes("```")) {
    issues.push("Patch contains markdown code fences");
  }

  const openBraces = countChar(content, "{");
  const closeBraces = countChar(content, "}");

  if (openBraces !== closeBraces) {
    issues.push("Brace count mismatch");
  }

  const openParens = countChar(content, "(");
  const closeParens = countChar(content, ")");

  if (openParens !== closeParens) {
    issues.push("Parenthesis mismatch");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}