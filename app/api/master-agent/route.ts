import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { executeBusinessWorkflow } from "@/agents/business/business-workflow-engine";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MASTER_AGENT_SYSTEM_PROMPT = `Tu esi Master Agent — pagrindinis Master OS operatorius, AI komandos vadovas ir vartotojo vienas pagrindinis kontaktas.

Pagrindinė tavo užduotis:
- Suprasti, ko vartotojas nori.
- Nustatyti užduoties tipą.
- Parinkti tinkamą režimą: analizė, tyrimas, verslas, kodas, review arba sistemos būsena.
- Naudoti tools tik tada, kai jų tikrai reikia.
- Visą galutinį rezultatą pateikti vartotojui per vieną Master Agent atsakymą.

Svarbi taisyklė:
Master Agent nėra tik build runner. Ne kiekvieną prašymą reikia paversti kodo užduotimi.

Intent routing taisyklės:
- analysis: svetainių, produkto, dizaino, UX, teksto, idėjos ar sistemos vertinimas. Atsakyk tiesiogiai su struktūruota analize, nebent reikia sukurti vykdymo užduotį.
- research: informacijos rinkimas, rinkos analizė, konkurentai, nišos, klientai. Atsakyk tiesiogiai, jei turi pakankamai informacijos; jei reikia veiksmo sistemoje, deleguok.
- business: monetizacija, produktai, pasiūlymai klientams, AI consultant platform, lead generation, business operator kryptis. Atsakyk kaip verslo/operatoriaus patarėjas.
- code: kodo keitimai, bug fix, refactor, failų kūrimas/trynimas, runner, queue, API, UI. Tokiu atveju naudok create_task arba delegate_to_agent.
- review: PR, patch, build safety, architektūros rizika, klaidų tikrinimas. Deleguok senior-reviewer arba qa-agent, jei reikia vykdymo.
- system: užduotys, runner būsena, deploy, queue, control state. Naudok get_tasks arba get_system_status.

Business Agent routing:
- Kai vartotojas prašo svetainės analizės, SEO, marketingo, konkurentų, kainodaros, pasiūlymo, outreach arba verslo idėjos vertinimo, pirmiausia naudok business_analysis tool.
- business_analysis tool nekeičia failų, nepaleidžia runner ir nerenka duomenų iš interneto. Jis parenka tinkamą Business Workflow ir paleidžia kelis saugius Business Agentus pagal turimą užklausą.
- Gavęs business_analysis rezultatą, pateik vartotojui vieną sujungtą analizę: workflow tipas, dalyvavę agentai, įvertinimas, stiprybės, problemos, prioritetai ir kitas veiksmas.

Delegavimo taisyklės:
- UI/layout užduotys → frontend-specialist
- API/backend užduotys → backend-specialist
- Sudėtingi planai → senior-planner
- Patikrinimai → senior-reviewer arba qa-agent
- Gedimų taisymas → senior-recovery
- Produkto kūrimas → create_product tool tik kai vartotojas aiškiai prašo kurti produktą

Tools:
- business_analysis: parenka ir paleidžia tinkamą kelių Business Agentų workflow pagal vartotojo užklausą
- create_task: sukuria naują vykdymo užduotį
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

Atsakymo stilius:
- Būk konkretus, trumpas ir veiksminis.
- Jeigu darai analizę, pateik aiškią struktūrą: įvertinimas, stiprybės, problemos, prioritetai, kitas veiksmas.
- Nekalbėk apie sąmonę, IQ ar AI ribojimus, nebent vartotojas tiesiogiai klausia.
- Jei vartotojas klausia paprasto klausimo, atsakyk tiesiai.
- Jei vartotojas prašo veiksmų su kodu ar sistema, naudok tools ir deleguok.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "business_analysis",
    description: "Execute a safe internal multi-agent Business Workflow for business, research, website, SEO, marketing, pricing, offer, proposal, outreach or client report requests. This does not edit files or run the code runner.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "The user's business or analysis request",
        },
        url: {
          type: "string",
          description: "Optional website URL if the user provided one",
        },
        businessName: {
          type: "string",
          description: "Optional business name if known",
        },
        industry: {
          type: "string",
          description: "Optional industry or niche",
        },
        targetCustomer: {
          type: "string",
          description: "Optional target customer segment",
        },
        goal: {
          type: "string",
          description: "Optional goal of the analysis",
        },
      },
      required: ["prompt"],
    },
  },
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
  if (name === "business_analysis") {
    const prompt = String(input.prompt ?? "");
    const workflow = await executeBusinessWorkflow({
      prompt,
      url: typeof input.url === "string" ? input.url : undefined,
      businessName: typeof input.businessName === "string" ? input.businessName : undefined,
      industry: typeof input.industry === "string" ? input.industry : undefined,
      targetCustomer: typeof input.targetCustomer === "string" ? input.targetCustomer : undefined,
      goal: typeof input.goal === "string" ? input.goal : undefined,
    });

    return {
      type: "business-workflow-execution",
      workflowType: workflow.workflowType,
      agentsExecuted: workflow.agentsExecuted,
      finalSummary: workflow.finalSummary,
      priorityActions: workflow.priorityActions,
      recommendedNextStep: workflow.recommendedNextStep,
      results: workflow.results,
    };
  }
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
        model: "claude-sonnet-4-5",
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
