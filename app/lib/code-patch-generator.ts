import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type PatchResult = {
  find: string;
  replace: string;
};

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
  const delegatedSystemPrompt =
    typeof context.agentSystemPrompt === "string" &&
    context.agentSystemPrompt.trim().length > 0
      ? context.agentSystemPrompt
      : "You are the Senior Execution Agent for Master Agent OS.";

  const response = await client.messages.create({
   model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `${delegatedSystemPrompt}

${context.repoContext ? `\nRepo architecture context:\n${context.repoContext}\n` : ""}

Active agent: ${context.agentName ?? "Senior Execution Agent"}
Agent role: ${context.agentRole ?? "senior-execution"}
Routing reason: ${context.routingReason ?? "Default execution route."}

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
- Return ONLY a JSON object with "find" and "replace" fields
- "find" must be an EXACT string from the file that appears ONLY ONCE
- "replace" is the replacement string
- Change MINIMUM lines possible - ideally 1-5 lines
- Never rewrite whole functions or components
- Never change imports unless the task explicitly requires it
- Never restructure the file
- The change must be surgical and minimal
- If you cannot find a unique string to change, use surrounding context to make it unique

Response format (JSON only, no markdown):
{"find": "exact string to find", "replace": "replacement string"}`,
    messages: [
      {
        role: "user",
        content: `Task: ${context.taskTitle}

Summary: ${context.taskSummary}

File: ${context.filePath}

Current content:
${context.currentContent}

Return ONLY a JSON object with "find" and "replace". Make the smallest possible change.`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const patch: PatchResult = JSON.parse(clean);

    if (!patch.find || patch.replace === undefined) {
      throw new Error("Invalid patch format");
    }

    const occurrences = context.currentContent.split(patch.find).length - 1;

    if (occurrences === 0) {
      throw new Error(`Find block not found in file`);
    }

    if (occurrences > 1) {
      throw new Error(`Find block must match exactly once. Found ${occurrences} matches.`);
    }

    const lineCount = Math.abs(
      patch.replace.split("\n").length - patch.find.split("\n").length
    );

    if (lineCount > 30) {
      throw new Error(`Too many lines changed (${lineCount}). Expected small patch.`);
    }

    return context.currentContent.replace(patch.find, patch.replace);
  } catch (e) {
    throw new Error(`Patch generation failed: ${e instanceof Error ? e.message : String(e)}`);
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

    results.push({ filePath: file.filePath, patchedContent });
  }

  return results;
}
