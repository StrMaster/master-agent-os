import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MASTER_AGENT_SYSTEM_PROMPT = `Tu esi Master Agent — autonominės AI inžinerijos sistemos vadovas ir koordinatorius.

Tavo rolė:
- Koordinuoji specializuotus agentus
- Deleguoji darbus pagal užduoties tipą
- Stebėk progresą ir pranešk apie blokerius
- Reikalauk žmogaus patvirtinimo aukštos rizikos sprendimams

Delegavimo taisyklės:
- UI/layout užduotys → frontend-specialist
- API/backend užduotys → backend-specialist
- Sudėtingi planai → senior-planner
- Patikrinimai → senior-reviewer arba qa-agent
- Gedimų taisymas → senior-recovery
- Produkto kūrimas → create_product tool


Tools:
- create_task: sukuria naują užduotį
- delegate_to_agent: deleguoja darbą specializuotam agentui
- get_tasks: rodo dabartines užduotis
- get_system_status: rodo sistemos būseną
- run_agent: paleidžia vykdymo ciklą

Kalbos kokybės taisyklės:
- Visada rašyk taisyklinga, natūralia lietuvių kalba.
- Nenaudok nereikalingų angliškų žodžių, jei yra geras lietuviškas atitikmuo.
- Nerašyk netaisyklingų frazių kaip "keli kalbos", "prašymas miglotus", "output".
- Jei atsakai lietuviškai, visas atsakymas turi būti lietuviškas.
- Skambėk kaip profesionalus AI operatorius, ne kaip paprastas chatbotas.

Kalbi lietuviškai. Esi konkretus ir veiksminis.
Kai žmogus prašo kažką padaryti — naudok tools ir deleguok.
Jei žmogus tiesiog kalbasi — atsakyk normaliai.`;


const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_task",
    description: "Create a new task for execution",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "Task description" },
        priority: { type: "string", description: "low | medium | high" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_tasks",
    description: "Get current tasks and their status",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_system_status",
    description: "Get deploy, runner, and queue status",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "run_agent",
    description: "Trigger auto-run cycle to execute queued tasks",
    input_schema: { type: "object" as const, properties: {} },
  },
    {
    name: "delegate_to_agent",
    description: "Delegate a specific task to a specialized agent (planner, frontend, backend, qa, recovery)",
    input_schema: {
      type: "object" as const,
      properties: {
        agentRole: {
          type: "string",
          description: "Agent role: senior-planner | frontend-specialist | backend-specialist | qa-agent | senior-recovery | senior-reviewer",
        },
        task: {
          type: "string",
          description: "Task description to delegate",
        },
        priority: {
          type: "string",
          description: "low | medium | high",
        },
      },
      required: ["agentRole", "task"],
    },
  },
  {
    name: "create_product",
    description: "Create a new AI product — generates code, creates GitHub repo and deploys to Vercel automatically",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Project name (lowercase, no spaces, use dashes)",
        },
        description: {
          type: "string",
          description: "What this product should do",
        },
        type: {
          type: "string",
          description: "ai-consultant | chatbot | landing-page | saas-tool",
        },
        industry: {
          type: "string",
          description: "dental | restaurant | real-estate | fitness | beauty | legal | general",
        },
      },
      required: ["name", "description"],
    },
  },
];

async function readConversationHistory(sessionId: string) {
  try {
if (!supabase) {
  return [];
}

    const { data, error } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at");

    if (error) {
      console.warn("[master-agent] failed to read conversation history", error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("[master-agent] failed to read conversation history", error);
    return [];
  }
}

async function saveConversationMessage({
  sessionId,
  role,
  content,
}: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
}) {
  try {
    if (!supabase) {
  return;
}
    const { error } = await supabase.from("conversations").insert({
      session_id: sessionId,
      role,
      content,
    });

    if (error) {
      console.warn("[master-agent] failed to save conversation message", error);
    }
  } catch (error) {
    console.warn("[master-agent] failed to save conversation message", error);
  }
}

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  }
}

async function handleTool(name: string, input: Record<string, unknown>, baseUrl: string) {
  const headers = {
    "Content-Type": "application/json",
    "x-cron-secret": process.env.CRON_SECRET ?? "",
    "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "",
    "x-vercel-set-bypass-cookie": "samesitenone",
  };
  if (name === "create_task") {
    const res = await fetch(`${baseUrl}/api/create-task`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    return await parseResponse(res);
  }
  if (name === "get_tasks") {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      cache: "no-store",
      headers,
    });
    return await parseResponse(res);
  }
  if (name === "get_system_status") {
    const res = await fetch(`${baseUrl}/api/control-state`, {
      cache: "no-store",
      headers,
    });
    return await parseResponse(res);
  }
  if (name === "run_agent") {
    const res = await fetch(`${baseUrl}/api/auto-run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ forceRunOnce: true }),
    });
    return await parseResponse(res);
  }
  if (name === "delegate_to_agent") {
    const res = await fetch(`${baseUrl}/api/create-task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: input.task,
        priority: input.priority ?? "medium",
        agentRole: input.agentRole,
        agentName: input.agentRole,
      }),
    });
    return await parseResponse(res);
  }
  if (name === "create_product") {
    const res = await fetch(`${baseUrl}/api/create-project`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        type: input.type ?? "ai-consultant",
        industry: input.industry ?? "general",
      }),
    });
    return await parseResponse(res);
  }

  return { error: "Unknown tool" };
}

export async function POST(req: Request) {
  try {
    const { message, sessionId } = await req.json();
    const baseUrl = new URL(req.url).origin;
    const safeSessionId = String(sessionId ?? "default-session");
    const safeMessage = String(message ?? "").trim();

    if (!safeMessage) {
      return NextResponse.json({ reply: "Parašyk žinutę Master Agentui." });
    }

    const history = await readConversationHistory(safeSessionId);

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: String(h.content ?? ""),
      })),
      { role: "user", content: safeMessage },
    ];

    await saveConversationMessage({
      sessionId: safeSessionId,
      role: "user",
      content: safeMessage,
    });

    let response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: MASTER_AGENT_SYSTEM_PROMPT,
      messages,
      tools: TOOLS,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      if (toolUseBlocks.length === 0) break;

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await handleTool(
            block.name,
            block.input as Record<string, unknown>,
            baseUrl
          );
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        })
      );

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: toolResults,
      });

      response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: MASTER_AGENT_SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      });
    }

    const reply = response.content.find((b) => b.type === "text");
    const replyText = reply?.type === "text" ? reply.text : "Nesupratau užklausos.";

    await saveConversationMessage({
      sessionId: safeSessionId,
      role: "assistant",
      content: replyText,
    });

    return NextResponse.json({ reply: replyText });
  } catch (error) {
    console.error("[master-agent] request failed", error);

    return NextResponse.json(
      {
        reply:
          "Master Agent route pasiekė klaidą. Patikrink ANTHROPIC_API_KEY, Supabase env ir Vercel build/runtime logs.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
