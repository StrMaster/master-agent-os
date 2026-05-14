import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SMART_AGENTS } from "@/agents/core/agent-registry";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT_LIST = SMART_AGENTS.map((a) => `${a.id}: ${a.purpose}`).join("\n");

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const safePrompt = String(prompt ?? "").trim();

    if (!safePrompt) {
      return NextResponse.json({ role: "senior-execution", reason: "Empty prompt", confidence: "low" });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `You are an agent router for Master Agent OS.
Given a user prompt, pick the best agent role from this list:

${AGENT_LIST}

Rules:
- Return ONLY valid JSON, no markdown
- Pick the most specific matching role
- If unclear, use "senior-execution"

Format: {"role":"...","reason":"...","confidence":"low|medium|high"}`,
      messages: [{ role: "user", content: safePrompt }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ role: "senior-execution", reason: "Routing fallback", confidence: "low" });
  }
}
