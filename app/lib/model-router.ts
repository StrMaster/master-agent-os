import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COST_KEY = "master-agent-os:token-usage";
const DAILY_TOKEN_LIMIT = 500_000;
const DAILY_COST_LIMIT_USD = 0.50;

export type ModelRole =
  | "planner"
  | "executor"
  | "reviewer"
  | "analyst"
  | "recovery";

const MODEL_MAP: Record<ModelRole, string> = {
  planner: "claude-haiku-4-5-20251001",
  executor: "claude-haiku-4-5-20251001",
  reviewer: "claude-haiku-4-5-20251001",
  analyst: "claude-haiku-4-5-20251001",
  recovery: "claude-haiku-4-5-20251001",
};

// Claude Haiku pricing per 1M tokens
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25 },
};

type UsageSnapshot = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  callCount: number;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Redis env vars");
  return new Redis({ url, token });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 0.25, output: 1.25 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

async function recordUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const redis = getRedis();
    const key = `${COST_KEY}:${todayKey()}`;
    const existing = await redis.get<UsageSnapshot>(key) ?? {
      date: todayKey(),
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      callCount: 0,
    };

    const updated: UsageSnapshot = {
      date: todayKey(),
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
      costUsd: existing.costUsd + calcCost(model, inputTokens, outputTokens),
      callCount: existing.callCount + 1,
    };

    await redis.set(key, updated, { ex: 60 * 60 * 48 });
  } catch {
    // silent — cost tracking never blocks execution
  }
}

async function checkLimits(): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const redis = getRedis();
    const key = `${COST_KEY}:${todayKey()}`;
    const usage = await redis.get<UsageSnapshot>(key);

    if (!usage) return { blocked: false };

    const totalTokens = usage.inputTokens + usage.outputTokens;

    if (totalTokens >= DAILY_TOKEN_LIMIT) {
      return { blocked: true, reason: `Daily token limit reached (${totalTokens.toLocaleString()} / ${DAILY_TOKEN_LIMIT.toLocaleString()})` };
    }

    if (usage.costUsd >= DAILY_COST_LIMIT_USD) {
      return { blocked: true, reason: `Daily cost limit reached ($${usage.costUsd.toFixed(4)} / $${DAILY_COST_LIMIT_USD})` };
    }

    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

export async function callModel(
  role: ModelRole,
  system: string,
  userContent: string,
  maxTokens = 512
): Promise<string> {
  const limits = await checkLimits();
  if (limits.blocked) {
    throw new Error(`Cost control: ${limits.reason}`);
  }

  const model = MODEL_MAP[role];

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  await recordUsage(model, inputTokens, outputTokens);

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return text.replace(/```json|```/g, "").trim();
}

export function getModelForRole(role: ModelRole): string {
  return MODEL_MAP[role];
}

export async function getTodayUsage(): Promise<UsageSnapshot | null> {
  try {
    const redis = getRedis();
    const key = `${COST_KEY}:${todayKey()}`;
    return await redis.get<UsageSnapshot>(key);
  } catch {
    return null;
  }
}
