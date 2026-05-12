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

export async function enqueueRuntimeTask(task: RuntimeQueueTask) {
  await redis.lpush(RUNTIME_QUEUE_KEY, JSON.stringify(task));
}

export async function getRuntimeQueueTasks(): Promise<RuntimeQueueTask[]> {
  const items = await redis.lrange<string>(RUNTIME_QUEUE_KEY, 0, 200);

  return items
    .map((item) => {
      try {
        return JSON.parse(item) as RuntimeQueueTask;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RuntimeQueueTask[];
}

export async function removeRuntimeTask(taskId: string) {
  const items = await getRuntimeQueueTasks();

  const target = items.find((task) => task.id === taskId);

  if (!target) {
    return;
  }

  await redis.lrem(RUNTIME_QUEUE_KEY, 1, JSON.stringify(target));
}

export async function clearRuntimeQueue() {
  await redis.del(RUNTIME_QUEUE_KEY);
}
