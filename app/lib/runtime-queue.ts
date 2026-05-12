import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
  await redis.lpush(
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
  const items = await redis.lrange<unknown>(RUNTIME_QUEUE_KEY, 0, 200);

  return items
    .map((item) => normalizeRuntimeQueueTask(item))
    .filter(Boolean) as RuntimeQueueTask[];
}

export async function removeRuntimeTask(taskId: string) {
  const rawItems = await redis.lrange<unknown>(RUNTIME_QUEUE_KEY, 0, 200);

  for (const rawItem of rawItems) {
    const task = normalizeRuntimeQueueTask(rawItem);

    if (task?.id !== taskId) {
      continue;
    }

    const itemToRemove =
      typeof rawItem === "string" ? rawItem : JSON.stringify(rawItem);

    await redis.lrem(RUNTIME_QUEUE_KEY, 1, itemToRemove);
    return;
  }
}

export async function clearRuntimeQueue() {
  await redis.del(RUNTIME_QUEUE_KEY);
}
