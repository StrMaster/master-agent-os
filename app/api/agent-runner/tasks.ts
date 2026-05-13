import { logActivity } from "./activity";
import { recordRuntimeRecoveryMemory } from "./memory";
import { readGithubJson, writeGithubJson } from "./github";
import type { AgentTask } from "./types";
import { analyzeRecoveryIntelligence } from "@/agents/core/recovery-intelligence";
import { getRuntimeQueueTasks } from "@/app/lib/runtime-queue";

const TASKS_PATH = ".agent/tasks.json";
const MAX_RECOVERY_RETRIES = 3;

function normalizeRecoverySignature(reason: string) {
  return reason.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

function stableJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function mergeRuntimeTasks(githubTasks: AgentTask[]) {
  try {
    const runtimeTasks = (await getRuntimeQueueTasks()) as AgentTask[];

    const merged = [...githubTasks];

    for (const runtimeTask of runtimeTasks) {
      const existingIndex = merged.findIndex(
        (task) => task.id === runtimeTask.id
      );

      const normalizedRuntimeTask: AgentTask = {
        ...runtimeTask,
        runtimeOnly: true,
        status: runtimeTask.status ?? "queued",
      };

      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...normalizedRuntimeTask,
        };

        continue;
      }

      merged.unshift(normalizedRuntimeTask);
    }

    return merged;
  } catch (error) {
    console.warn("[tasks] failed to merge Redis runtime tasks", error);
    return githubTasks;
  }
}

export async function readTasksFile() {
  const { json, sha } = await readGithubJson(TASKS_PATH);

  const githubTasks = Array.isArray(json)
    ? (json as AgentTask[])
    : [];

  return {
    tasks: await mergeRuntimeTasks(githubTasks),
    sha,
  };
}

export async function writeTasksFile(
  tasks: AgentTask[],
  sha: string,
  message: string
) {
  const persistentTasks = tasks.filter(
    (task) => task.runtimeOnly !== true
  );

  const { json } = await readGithubJson(TASKS_PATH);
  const currentPersistentTasks = Array.isArray(json)
    ? (json as AgentTask[])
    : [];

  if (stableJson(currentPersistentTasks) === stableJson(persistentTasks)) {
    console.log("[tasks] skipped GitHub write for runtime-only/no-op update", message);
// Update runtime-only tasks directly in Redis
const runtimeOnlyUpdates = tasks.filter(t => t.runtimeOnly === true);
if (runtimeOnlyUpdates.length > 0) {
  try {
    const { updateRuntimeQueueTask } = await import("@/app/lib/runtime-queue");
    for (const task of runtimeOnlyUpdates) {
      await updateRuntimeQueueTask(task.id, task);
    }
  } catch (e) {
    console.warn("[tasks] failed to update runtime tasks in Redis", e);
  }
}
return;

  }

  await writeGithubJson(TASKS_PATH, persistentTasks, sha, message);
}

export async function createRecoveryTask({
  failedTask,
  reason,
}: {
  failedTask: AgentTask;
  reason: string;
}) {
  const { tasks, sha } = await readTasksFile();
  const recoveryOfTaskId = failedTask.recoveryOfTaskId ?? failedTask.id;
  const recoverySignature = normalizeRecoverySignature(reason);
  const intelligence = await analyzeRecoveryIntelligence({
    taskId: recoveryOfTaskId,
    targetFile: failedTask.targetFile,
    reason,
  }).catch(() => null);

  const existingRecoveryTask = tasks.find(
    (task) =>
      task.recoveryOfTaskId === recoveryOfTaskId &&
      task.recoverySignature === recoverySignature
  );

  if (existingRecoveryTask) {
    if (existingRecoveryTask.status === "failed") {
      const retryCount = existingRecoveryTask.retryCount ?? 0;

      if (retryCount >= MAX_RECOVERY_RETRIES) {
        await logActivity({
          type: "recovery-retry-blocked",
          runId: existingRecoveryTask.id,
          taskId: recoveryOfTaskId,
          agentName: "Senior Recovery Agent",
          reason: "Recovery retry limit reached",
          details: JSON.stringify({
            reason,
            intelligence: intelligence?.recommendation,
          }),
        });

        await recordRuntimeRecoveryMemory({
          taskId: recoveryOfTaskId,
          recoveryTaskId: existingRecoveryTask.id,
          reason,
          status: "retry-blocked",
        }).catch(() => {});

        return existingRecoveryTask;
      }

      existingRecoveryTask.status = "todo";
      existingRecoveryTask.retryCount = retryCount + 1;
      existingRecoveryTask.lastRetryAt = new Date().toISOString();
      existingRecoveryTask.previewOnly = true;
      existingRecoveryTask.requiresApproval = true;
      existingRecoveryTask.completedAt = undefined;
      existingRecoveryTask.updatedAt = new Date().toISOString();
      existingRecoveryTask.error = undefined;

      await writeTasksFile(
        tasks,
        sha,
        `Retry recovery task for ${recoveryOfTaskId}`
      );

      await logActivity({
        type: "recovery-retry-started",
        runId: existingRecoveryTask.id,
        taskId: recoveryOfTaskId,
        agentName: "Senior Recovery Agent",
        reason,
        details: JSON.stringify({
          retryCount: existingRecoveryTask.retryCount,
          recoveryOfTaskId,
          intelligence: intelligence?.recommendation,
        }),
      });

      await recordRuntimeRecoveryMemory({
        taskId: recoveryOfTaskId,
        recoveryTaskId: existingRecoveryTask.id,
        reason,
        status: "retry-started",
      }).catch(() => {});

      return existingRecoveryTask;
    }

    await logActivity({
      type: "recovery-task-duplicate-blocked",
      runId: existingRecoveryTask.id,
      taskId: recoveryOfTaskId,
      agentName: "Senior Recovery Agent",
      reason: intelligence?.recommendation
        ? `${reason} (${intelligence.recommendation})`
        : reason,
    });

    await recordRuntimeRecoveryMemory({
      taskId: recoveryOfTaskId,
      recoveryTaskId: existingRecoveryTask.id,
      reason,
      status: "duplicate-blocked",
    }).catch(() => {});

    return existingRecoveryTask;
  }

  const recoveryTask: AgentTask = {
    id: `recovery-${Date.now()}`,
    title: `Recovery: ${failedTask.title}`,
    summary: `Recover failed task: ${failedTask.id}`,
    targetFile: failedTask.targetFile,
    status: "todo",
    priority: "high",
    createdAt: new Date().toISOString(),
    previewOnly: true,
    requiresApproval: true,
    retryCount: 0,
    lastRetryAt: new Date().toISOString(),
    agentRole: "senior-recovery",
    agentName: "Senior Recovery Agent",
    recoveryOfTaskId,
    recoveryReason: reason,
    recoverySignature,
    plannerNotes:
      intelligence?.recommendation
        ? `Automatically generated recovery task after reviewer/execution failure. Recovery intelligence: ${intelligence.recommendation}.`
        : "Automatically generated recovery task after reviewer/execution failure.",
  };

  tasks.unshift(recoveryTask);

  await writeTasksFile(tasks, sha, `Create recovery task for ${failedTask.id}`);

  await logActivity({
    type: "recovery-retry-started",
    runId: recoveryTask.id,
    taskId: recoveryOfTaskId,
    agentName: "Senior Recovery Agent",
    reason,
    details: JSON.stringify({
      retryCount: recoveryTask.retryCount,
      recoveryOfTaskId,
      intelligence: intelligence?.recommendation,
    }),
  });

  await recordRuntimeRecoveryMemory({
    taskId: recoveryOfTaskId,
    recoveryTaskId: recoveryTask.id,
    reason,
    status: "created",
  }).catch(() => {});

  return recoveryTask;
}
