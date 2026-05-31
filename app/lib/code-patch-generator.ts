import Anthropic from "@anthropic-ai/sdk";
import { validatePatch } from "@/app/lib/patch-validator";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type PatchResult = {
  find: string;
  replace: string;
};

type PatchMode = "surgical" | "full-file";

const LARGE_FILE_LINE_THRESHOLD = 180;
const FULL_FILE_MAX_TOKENS = 8192;
const SURGICAL_MAX_TOKENS = 2048;

export async function generateCodePatch(context: {
  filePath: string;
  currentContent: string;
  taskTitle: string;
  taskSummary: string;
  projectState?: string;
  repoContext?: string;
  agentSystemPrompt?: string;
  agentName?: string;
  agentRole?: string;
  routingReason?: string;
}): Promise<string> {
  const fileLines = (context.currentContent || "").split("\n");

  if (!context.currentContent) {
    const fullFile = await generatePatchWithMode(context, "full-file");
    return validateGeneratedContent(fullFile, context.filePath);
  }

  const shouldPreferFullFile = shouldUseFullFileMode(context.filePath, fileLines.length);

  if (shouldPreferFullFile) {
    try {
      const fullFile = await generatePatchWithMode(context, "full-file");
      return validateGeneratedContent(fullFile, context.filePath);
    } catch (fullFileError) {
      console.warn("Full-file patch failed, falling back to surgical patch:", fullFileError);
    }
  }

  try {
    const surgicalPatch = await generatePatchWithMode(context, "surgical");
    return validateGeneratedContent(surgicalPatch, context.filePath);
  } catch (surgicalError) {
    if (!shouldAllowFallbackToFullFile(context.filePath, fileLines.length, surgicalError)) {
      throw new Error(`Patch generation failed: ${surgicalError instanceof Error ? surgicalError.message : String(surgicalError)}`);
    }

    const fullFile = await generatePatchWithMode(context, "full-file");
    return validateGeneratedContent(fullFile, context.filePath);
  }
}

async function generatePatchWithMode(context: {
  filePath: string;
  currentContent: string;
  taskTitle: string;
  taskSummary: string;
  projectState?: string;
  repoContext?: string;
  agentSystemPrompt?: string;
  agentName?: string;
  agentRole?: string;
  routingReason?: string;
}, mode: PatchMode): Promise<string> {
  const delegatedSystemPrompt =
    typeof context.agentSystemPrompt === "string" && context.agentSystemPrompt.trim().length > 0
      ? context.agentSystemPrompt
      : "You are the Senior Execution Agent for Master Agent OS.";

  const fileLines = (context.currentContent || "").split("\n");
  const currentContentForPrompt = mode === "full-file"
    ? context.currentContent
    : fileLines.length > 300
      ? fileLines.slice(0, 300).join("\n") + `\n// ... [${fileLines.length - 300} more lines truncated]`
      : context.currentContent;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: mode === "full-file" ? FULL_FILE_MAX_TOKENS : SURGICAL_MAX_TOKENS,
    system: `${delegatedSystemPrompt}

${context.repoContext ? `\nRepo architecture context:\n${context.repoContext}\n` : ""}

Active agent: ${context.agentName ?? "Senior Execution Agent"}
Agent role: ${context.agentRole ?? "senior-execution"}
Routing reason: ${context.routingReason ?? "Default execution route."}

${mode === "full-file" ? fullFileRules() : surgicalRules()}`,
    messages: [
      {
        role: "user",
        content: `Task: ${context.taskTitle}

Summary: ${context.taskSummary}

File: ${context.filePath}

${context.currentContent
  ? `Current content:\n${currentContentForPrompt}\n\n${mode === "full-file"
    ? "Return ONLY a JSON object where find is empty and replace is the COMPLETE updated file content."
    : "Return ONLY a JSON object with find and replace. Make the smallest possible safe change."}`
  : `This is a NEW file that does not exist yet. Create the full file content.\nReturn ONLY a JSON object where find is empty and replace is the complete new file content.`
}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const patch = parsePatch(raw);

  if (mode === "full-file" || !context.currentContent) {
    if (patch.find !== "") {
      throw new Error("Full-file mode requires an empty find field");
    }
    if (!patch.replace?.trim()) {
      throw new Error("Full-file mode requires complete replacement content");
    }
    return patch.replace;
  }

  if (!patch.find || patch.replace === undefined) {
    throw new Error("Invalid patch format");
  }

  const occurrences = context.currentContent.split(patch.find).length - 1;
  if (occurrences === 0) {
    throw new Error("Find block not found in file");
  }
  if (occurrences > 1) {
    throw new Error(`Find block must match exactly once. Found ${occurrences} matches.`);
  }

  const isDeletion = patch.replace === "";
  const lineCount = Math.abs(patch.replace.split("\n").length - patch.find.split("\n").length);
  if (!isDeletion && lineCount > 60) {
    throw new Error(`Too many lines changed (${lineCount}). Expected small patch.`);
  }

  const result = context.currentContent.replace(patch.find, patch.replace);
  await reviewGeneratedContent(result, context.filePath);
  return result;
}

function surgicalRules() {
  return `CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
- Return ONLY a JSON object with "find" and "replace" fields
- "find" must be an EXACT string from the file that appears ONLY ONCE
- "replace" is the replacement string
- Change MINIMUM lines possible - ideally 1-5 lines
- Never rewrite whole functions or components unless the task explicitly requires it
- Never change imports unless the task explicitly requires it
- Never restructure the file
- If you cannot find a unique string to change, use surrounding context to make it unique
- To DELETE code: set "find" to the exact block to remove, and "replace" to "" (empty string)

Response format (JSON only, no markdown):
{"find": "exact string to find", "replace": "replacement string"}`;
}

function fullFileRules() {
  return `CRITICAL RULES - FULL FILE MODE:
- Return ONLY a JSON object with "find" and "replace" fields
- "find" MUST be "" (empty string)
- "replace" MUST be the COMPLETE updated file content
- Preserve the existing architecture and exports
- Keep unrelated code unchanged
- Do not include markdown fences
- Do not omit imports, closing tags, or trailing code
- Use this mode when JSX is complex, the file is large, or surgical find/replace is unsafe

Response format (JSON only, no markdown):
{"find": "", "replace": "complete updated file content"}`;
}

function parsePatch(raw: string): PatchResult {
  const clean = raw.replace(/```json|```/g, "").trim();
  const patch = JSON.parse(clean) as PatchResult;
  if (typeof patch.find !== "string" || typeof patch.replace !== "string") {
    throw new Error("Invalid patch JSON fields");
  }
  return patch;
}

function shouldUseFullFileMode(filePath: string, lineCount: number) {
  return lineCount >= LARGE_FILE_LINE_THRESHOLD || filePath.endsWith(".tsx");
}

function shouldAllowFallbackToFullFile(filePath: string, lineCount: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return filePath.endsWith(".tsx") ||
    lineCount >= LARGE_FILE_LINE_THRESHOLD ||
    message.includes("Find block not found") ||
    message.includes("must match exactly once") ||
    message.includes("Too many lines changed") ||
    message.includes("Self-review failed");
}

function validateGeneratedContent(content: string, filePath: string) {
  const validation = validatePatch(content, filePath);
  if (!validation.valid) {
    throw new Error(`Generated content validation failed: ${validation.issues.join(", ")}`);
  }
  return content;
}

async function reviewGeneratedContent(content: string, filePath: string) {
  const reviewResponse = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system: "You are a TypeScript code reviewer. Answer ONLY with JSON: {\"ok\": true} or {\"ok\": false, \"reason\": \"short reason\"}",
    messages: [
      {
        role: "user",
        content: `Review this TypeScript/TSX patch for obvious errors (wrong import names, missing exports, syntax issues).
File: ${filePath}
Patch result:
${content.slice(0, 3000)}

Reply ONLY with JSON: {"ok": true} or {"ok": false, "reason": "..."}`,
      },
    ],
  });

  const reviewRaw = reviewResponse.content[0]?.type === "text" ? reviewResponse.content[0].text : "{}";
  try {
    const reviewClean = reviewRaw.replace(/```json|```/g, "").trim();
    const review = JSON.parse(reviewClean) as { ok: boolean; reason?: string };
    if (!review.ok && review.reason) {
      throw new Error(`Self-review failed: ${review.reason}`);
    }
  } catch (reviewErr) {
    if (reviewErr instanceof Error && reviewErr.message.startsWith("Self-review failed:")) {
      throw reviewErr;
    }
  }
}

export async function generateMultiFilePatch(context: {
  files: Array<{ filePath: string; currentContent: string }>;
  taskTitle: string;
  taskSummary: string;
  projectState?: string;
  repoContext?: string;
  agentSystemPrompt?: string;
  agentName?: string;
  agentRole?: string;
  routingReason?: string;
}): Promise<Array<{ filePath: string; patchedContent: string }>> {
  const results: Array<{ filePath: string; patchedContent: string }> = [];

  for (const file of context.files) {
    const patchedContent = await generateCodePatch({
      filePath: file.filePath,
      currentContent: file.currentContent,
      taskTitle: context.taskTitle,
      taskSummary: context.taskSummary,
      projectState: context.projectState,
      repoContext: context.repoContext,
      agentSystemPrompt: context.agentSystemPrompt,
      agentName: context.agentName,
      agentRole: context.agentRole,
      routingReason: context.routingReason,
    });

    const validation = validatePatch(patchedContent, file.filePath);
    if (!validation.valid) {
      throw new Error(`Multi-file patch validation failed for ${file.filePath}: ${validation.issues.join(", ")}`);
    }

    results.push({ filePath: file.filePath, patchedContent });
  }

  return results;
}
