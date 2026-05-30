import { Redis } from "@upstash/redis";

const COORDINATION_MEMORY_KEY = "master-agent-os:coordination-memory";
const AGENT_STATUS_KEY = "master-agent-os:agent-status";
const MAX_EVENTS = 50;

export type CoordinationEvent = {
  timestamp: number;
  agent: string;
  type: string;
  summary: string;
  taskId?: string;
  targetFile?: string;
};

export type AgentStatus = {
  agentRole: string;
  agentName: string;
  status: "idle" | "working" | "blocked" | "done";
  currentTaskId?: string;
  currentTaskTitle?: string;
  startedAt?: string;
  updatedAt: string;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash Redis environment variables");
  }

  return new Redis({ url, token });
}

export async function addCoordinationEvent(event: CoordinationEvent): Promise<void> {
  try {
    const redis = getRedis();
    const existing = await redis.get<CoordinationEvent[]>(COORDINATION_MEMORY_KEY) ?? [];
    const updated = [event, ...existing].slice(0, MAX_EVENTS);
    await redis.set(COORDINATION_MEMORY_KEY, updated);
  } catch (error) {
    console.warn("[coordination-memory] failed to add event", error);
  }
}

export async function getCoordinationMemory(): Promise<CoordinationEvent[]> {
  try {
    const redis = getRedis();
    const data = await redis.get<CoordinationEvent[]>(COORDINATION_MEMORY_KEY);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("[coordination-memory] failed to read memory", error);
    return [];
  }
}

export async function clearCoordinationMemory(): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(COORDINATION_MEMORY_KEY);
  } catch (error) {
    console.warn("[coordination-memory] failed to clear memory", error);
  }
}

export async function updateAgentStatus(status: AgentStatus): Promise<void> {
  try {
    const redis = getRedis();
    const existing = await redis.get<AgentStatus[]>(AGENT_STATUS_KEY) ?? [];
    const filtered = existing.filter(s => s.agentRole !== status.agentRole);
    await redis.set(AGENT_STATUS_KEY, [status, ...filtered]);
  } catch (error) {
    console.warn("[coordination-memory] failed to update agent status", error);
  }
}

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  try {
    const redis = getRedis();
    const data = await redis.get<AgentStatus[]>(AGENT_STATUS_KEY);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("[coordination-memory] failed to read agent statuses", error);
    return [];
  }
}
