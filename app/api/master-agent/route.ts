import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
];

async function handleTool(name: string, input: Record<string, unknown>, baseUrl: string) {
  if (name === "create_task") {
    const res = await fetch(`${baseUrl}/api/create-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return await res.json();
  }
  if (name === "get_tasks") {
    const res = await fetch(`${baseUrl}/api/tasks`, { cache: "no-store" });
    return await res.json();
  }
  if (name === "get_system_status") {
    const res = await fetch(`${baseUrl}/api/control-state`, { cache: "no-store" });
    return await res.json();
  }
  if (name === "run_agent") {
    const res = await fetch(`${baseUrl}/api/auto-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRunOnce: true }),
    });
    return await res.json();
  }
  return { error: "Unknown tool" };
}

export async function POST(req: Request) {
  try {
    const { message, sessionId } = await req.json();
    const baseUrl = new URL(req.url).origin;

    const { data: history } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at");

    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    await supabase.from("conversations").insert({
      session_id: sessionId,
      role: "user",
      content: message,
    });

    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `Tu esi Master Agent — autonominės AI inžinerijos sistemos vadovas.
Turi prieigą prie tools: sukurti taskus, peržiūrėti sistemos būseną, paleisti agentus.
Kalbi lietuviškai. Esi konkretus ir veiksminis.
Kai žmogus prašo kažką padaryti sistemoje — naudok tools.
Kai klausia apie būseną — naudok get_system_status arba get_tasks.`,
      messages,
      tools: TOOLS,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (!toolUseBlock || toolUseBlock.type !== "tool_use") break;

      const toolResult = await handleTool(
        toolUseBlock.name,
        toolUseBlock.input as Record<string, unknown>,
        baseUrl
      );

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });

      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Tu esi Master Agent — autonominės AI inžinerijos sistemos vadovas.
Turi prieigą prie tools: sukurti taskus, peržiūrėti sistemos būseną, paleisti agentus.
Kalbi lietuviškai. Esi konkretus ir veiksminis.`,
        messages,
        tools: TOOLS,
      });
    }

    const reply = response.content.find((b) => b.type === "text");
    const replyText = reply?.type === "text" ? reply.text : "Nesupratau užklausos.";

    await supabase.from("conversations").insert({
      session_id: sessionId,
      role: "assistant",
      content: replyText,
    });

    return NextResponse.json({ reply: replyText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
