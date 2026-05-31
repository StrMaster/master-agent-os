export type AgentIdentity = {
  role:
    | "planner"
    | "executor"
    | "reviewer"
    | "deploy";

  name: string;

  goals: string[];

  strengths: string[];

  responsibilities: string[];
};

export const AGENT_IDENTITIES: Record<
  string,
  AgentIdentity
> = {
  planner: {
    role: "planner",

    name: "Planner Agent",

    goals: [
      "Plan safe execution sequences",
      "Reduce chaos in execution",
      "Prioritize roadmap work",
    ],

    strengths: [
      "Task sequencing",
      "Roadmap planning",
      "Dependency awareness",
    ],

    responsibilities: [
      "Create execution plans",
      "Prioritize tasks",
      "Coordinate execution order",
    ],
  },

  executor: {
    role: "executor",

    name: "Execution Agent",

    goals: [
      "Safely execute engineering tasks",
      "Avoid breaking production",
      "Deliver incremental improvements",
    ],

    strengths: [
      "Implementation",
      "Runtime operations",
      "Safe execution",
    ],

    responsibilities: [
      "Execute tasks",
      "Apply improvements",
      "Handle runtime operations",
    ],
  },

  reviewer: {
    role: "reviewer",

    name: "Reviewer Agent",

    goals: [
      "Detect risks",
      "Reduce failures",
      "Improve system quality",
    ],

    strengths: [
      "Analysis",
      "Failure detection",
      "Risk evaluation",
    ],

    responsibilities: [
      "Review execution",
      "Detect problems",
      "Generate fix recommendations",
    ],
  },

  deploy: {
    role: "deploy",

    name: "Deploy Agent",

    goals: [
      "Protect production stability",
      "Monitor deployments",
      "Reduce deployment failures",
    ],

    strengths: [
      "Deployment analysis",
      "Production awareness",
      "Monitoring",
    ],

    responsibilities: [
      "Monitor deploys",
      "Validate production readiness",
      "Detect deployment risks",
    ],
  },
};

// ─── Long-term memory (Supabase pgvector) ────────────────────────────────────

import { getSupabase } from "@/app/lib/supabase";
import OpenAI from "openai";

export type MemoryEntry = {
  id?: string;
  content: string;
  category: "task-outcome" | "error-pattern" | "file-context" | "agent-decision";
  metadata?: Record<string, unknown>;
  created_at?: string;
};

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const client = new OpenAI({ apiKey });
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 2000),
    });
    return res.data[0]?.embedding ?? [];
  } catch {
    return [];
  }
}

export async function storeMemory(entry: MemoryEntry): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const embedding = await getEmbedding(entry.content);

    const { error } = await supabase.from("agent_memories").insert({
      content: entry.content,
      category: entry.category,
      metadata: entry.metadata ?? {},
      embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
    });

    return !error;
  } catch {
    return false;
  }
}

export async function searchMemory(
  query: string,
  category?: MemoryEntry["category"],
  limit = 5
): Promise<MemoryEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const embedding = await getEmbedding(query);
    if (embedding.length === 0) return [];

    const { data, error } = await supabase.rpc("match_agent_memories", {
      query_embedding: JSON.stringify(embedding),
      match_category: category ?? null,
      match_count: limit,
    });

    if (error || !data) return [];
    return data as MemoryEntry[];
  } catch {
    return [];
  }
}