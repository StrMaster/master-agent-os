function countChar(content: string, char: string) {
  return content.split(char).length - 1;
}

// Check for common TypeScript import mistakes
function checkImports(content: string): string[] {
  const issues: string[] = [];
  const importLines = content.split("\n").filter((l) => l.trim().startsWith("import "));

  for (const line of importLines) {
    // Detect named imports: import { Foo } from "..."
    const namedMatch = line.match(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/);
    if (namedMatch) {
      const names = namedMatch[1].split(",").map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        // Flag suspicious camelCase inconsistencies (e.g. createGitHubRepo vs createGithubRepo)
        if (/[a-z][A-Z]{2,}[a-z]/.test(name)) {
          issues.push(`Suspicious import name casing: "${name}" — verify exact export name`);
        }
      }
    }
  }

  return issues;
}

// Check JSX tag balance
function checkJsxBalance(content: string): string[] {
  const issues: string[] = [];

  // Count self-closing vs open/close tags for common elements
  const openTags = (content.match(/<(div|span|section|main|nav|ul|ol|li|form|button|input|a|p|h[1-6])[^/]*>/gi) ?? []).length;
  const closeTags = (content.match(/<\/(div|span|section|main|nav|ul|ol|li|form|button|input|a|p|h[1-6])>/gi) ?? []).length;

  if (Math.abs(openTags - closeTags) > 2) {
    issues.push(`JSX tag imbalance: ${openTags} opening vs ${closeTags} closing tags`);
  }

  return issues;
}

// Check for obvious TypeScript syntax issues
function checkTypeScriptSyntax(content: string, filePath?: string): string[] {
  const issues: string[] = [];
  const isTs = !filePath || filePath.endsWith(".ts") || filePath.endsWith(".tsx");

  if (!isTs) return issues;

  // Detect "any" cast without type (risky but not blocking)
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Unclosed template literal
    const backticks = (line.match(/`/g) ?? []).length;
    if (backticks % 2 !== 0 && !line.trim().startsWith("//")) {
      // Allow multiline template literals — only flag if next line also has issue
      // Skip this as too many false positives
    }

    // Detect: export default with missing return type on arrow fn (not blocking)
    // Detect: obvious undefined variable patterns
    if (/\bawait\b/.test(line) && !/\basync\b/.test(content.slice(0, content.indexOf(line))) && !content.includes("async function") && !content.includes("async (")) {
      // await outside async — only flag if file has no async at all
      if (!content.includes("async")) {
        issues.push(`Line ${i + 1}: "await" used but no "async" function found`);
        break;
      }
    }
  }

  return issues;
}

// Check for duplicate exports
function checkDuplicateExports(content: string): string[] {
  const issues: string[] = [];
  const exportNames = new Map<string, number>();

  const matches = content.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+(\w+)/g);
  for (const match of matches) {
    const name = match[1];
    exportNames.set(name, (exportNames.get(name) ?? 0) + 1);
  }

  for (const [name, count] of exportNames) {
    if (count > 1) {
      issues.push(`Duplicate export: "${name}" exported ${count} times`);
    }
  }

  return issues;
}

export function validatePatch(content: string, filePath?: string) {
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
    issues.push(`Brace count mismatch: ${openBraces} opening vs ${closeBraces} closing`);
  }

  const openParens = countChar(content, "(");
  const closeParens = countChar(content, ")");

  if (openParens !== closeParens) {
    issues.push(`Parenthesis mismatch: ${openParens} opening vs ${closeParens} closing`);
  }

  // TypeScript-specific checks
  issues.push(...checkImports(content));
  issues.push(...checkTypeScriptSyntax(content, filePath));
  issues.push(...checkDuplicateExports(content));

  // JSX checks for .tsx files
  if (filePath?.endsWith(".tsx")) {
    issues.push(...checkJsxBalance(content));
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
