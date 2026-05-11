import { logActivity } from "./activity";
import { recordRuntimeRecoveryMemory } from "./state";
import { readGithubJson, writeGithubJson } from "./github";
import type { AgentTask } from "./types";

const TASKS_PATH = ".agent/tasks.json";
const MAX_RECOVERY_RETRIES = 3;

function normalizeRecoverySignature(reason: string) {
  return reason.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

export async function readTasksFile() {
  const { json, sha } = await readGithubJson(TASKS_PATH);

  return {
    tasks: Array.isArray(json) ? (json as AgentTask[]) : [],
    sha,
  };
}

export async function writeTasksFile(
  tasks: AgentTask[],
  sha: string,
  message: string
) {
  await writeGithubJson(TASKS_PATH, tasks, sha, message);
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
          details: reason,
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
      reason,
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
      "Automatically generated recovery task after reviewer/execution failure.",
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
