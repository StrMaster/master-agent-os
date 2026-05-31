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

// Lightweight JSX sanity check.
// This intentionally avoids full parsing because modern TSX often contains
// fragments, components, conditionals, generics and self-closing tags that make
// simple open/close counts unreliable. The build step remains the real compiler.
function checkJsxBalance(content: string): string[] {
  const issues: string[] = [];
  const stack: string[] = [];
  const tagRegex = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const htmlTags = new Set([
    "a", "article", "aside", "button", "canvas", "code", "div", "em", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "html", "label", "li", "main", "nav", "ol", "option", "p", "pre", "section", "select", "span", "strong", "svg", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "tr", "ul",
    ...Array.from(voidTags),
  ]);

  for (const match of content.matchAll(tagRegex)) {
    const full = match[0];
    const originalTag = match[1];
    const tag = originalTag.toLowerCase();

    if (!htmlTags.has(tag)) {
      issues.push(`Invalid lowercase JSX custom tag: <${originalTag}>. Use a standard HTML tag like <div>/<section> or a PascalCase React component.`);
      break;
    }

    if (full.startsWith("</")) {
      const previous = stack.pop();
      if (previous && previous !== tag) {
        issues.push(`Possible JSX tag mismatch: expected </${previous}> before </${tag}>`);
        break;
      }
      continue;
    }

    if (full.endsWith("/>") || voidTags.has(tag)) continue;
    stack.push(tag);
  }

  if (stack.length > 0 && stack.length <= 2) {
    issues.push(`Possible unclosed JSX tag: <${stack[stack.length - 1]}>`);
  }

  if (stack.length > 2) {
    issues.push(`Possible JSX tag imbalance: ${stack.length} unclosed tags`);
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
