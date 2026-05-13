import { Redis } from "@upstash/redis";

const RUNTIME_QUEUE_KEY = "master-agent-os:runtime-queue";

export type RuntimeQueueTask = {
  id: string;
  title: string;
  summary?: string;
  targetFile?: string;
  status?: string;
  priority?: string;
  intent?: string;
  riskLevel?: string;
  executionMode?: string;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  createdAt?: string;
  queuedAt?: string;
  updatedAt?: string;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  console.log("[runtime-queue] getRedis", {
    urlPrefix: url ? url.slice(0, 20) : null,
    hasToken: Boolean(token),
  });

  if (!url || !token) {
    throw new Error("Missing Upstash Redis environment variables");
  }

  return new Redis({ url, token });
}

function normalizeRuntimeQueueTask(item: unknown): RuntimeQueueTask | null {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    try {
      return normalizeRuntimeQueueTask(JSON.parse(item));
    } catch {
      return null;
    }
  }

  if (typeof item !== "object") {
    return null;
  }

  const task = item as RuntimeQueueTask;

  if (!task.id || !task.title) {
    return null;
  }

  return {
    ...task,
    status: task.status ?? "queued",
    previewOnly: task.previewOnly === true,
    requiresApproval: task.requiresApproval === true,
    queuedAt: task.queuedAt ?? task.createdAt ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? task.queuedAt ?? task.createdAt ?? new Date().toISOString(),
  };
}

export async function enqueueRuntimeTask(task: RuntimeQueueTask) {
  await getRedis().lpush(
    RUNTIME_QUEUE_KEY,
    JSON.stringify(
      normalizeRuntimeQueueTask({
        ...task,
        status: task.status ?? "queued",
      }) ?? task,
    ),
  );
}

export async function getRuntimeQueueTasks(): Promise<RuntimeQueueTask[]> {
  const items = await getRedis().lrange<unknown>(RUNTIME_QUEUE_KEY, 0, 200);

  return items
    .map((item) => normalizeRuntimeQueueTask(item))
    .filter(Boolean) as RuntimeQueueTask[];
}

export async function removeRuntimeTask(taskId: string) {
  const rawItems = await getRedis().lrange<unknown>(RUNTIME_QUEUE_KEY, 0, 200);

  for (const rawItem of rawItems) {
    const task = normalizeRuntimeQueueTask(rawItem);

    if (task?.id !== taskId) {
      continue;
    }

    const itemToRemove =
      typeof rawItem === "string" ? rawItem : JSON.stringify(rawItem);

    await getRedis().lrem(RUNTIME_QUEUE_KEY, 1, itemToRemove);
    return;
  }
}

export async function clearRuntimeQueue() {
  await getRedis().del(RUNTIME_QUEUE_KEY);
}
