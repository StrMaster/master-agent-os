import OpenAI from "openai";
import { getAgentPrompt } from "@/agents/prompts";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCodePatch(context: {
  filePath: string;
  currentContent: string;
  taskTitle: string;
  taskSummary: string;
  projectState?: string;
  agentSystemPrompt?: string;
  agentName?: string;
  agentRole?: string;
  routingReason?: string;
}) {
  const delegatedSystemPrompt =
  typeof context.agentSystemPrompt === "string" &&
  context.agentSystemPrompt.trim().length > 0
    ? context.agentSystemPrompt
    : "You are the Senior Execution Agent for Master Agent OS.";
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: ` ${delegatedSystemPrompt}

Active agent: ${context.agentName ?? "Senior Execution Agent"}
Agent role: ${context.agentRole ?? "senior-execution"}
Routing reason: ${context.routingReason ?? "Default execution route."}

Your job:
- modify existing code safely
- preserve working structure
- avoid breaking syntax
- follow the current project architecture

Rules:
- Return ONLY raw code.
- No markdown.
- No explanations.
- No code fences.
- Follow the Project State rules when provided.
- Do not rebuild the project from scratch.
- Do not create a parallel execution system.
- Do not reintroduce legacy propose/apply routes.
- Do not use direct main apply flow.
- Prefer small, scoped, build-safe edits.
- Preserve imports unless necessary.
- Keep edits minimal and safe.
- Never respond in German.
`,
      },
      {
        role: "user",
        content: `
Task:
${context.taskTitle}

Summary:
${context.taskSummary}

Project State:
${context.projectState ?? "No project state provided."}

File:
${context.filePath}

Current content:
${context.currentContent}
`,
      },
    ],
  });

  return response.choices[0]?.message?.content || "";
}