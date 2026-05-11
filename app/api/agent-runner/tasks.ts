import { logActivity } from "./activity";
import { readGithubJson, writeGithubJson } from "./github";
import type { AgentTask } from "./types";

const TASKS_PATH = ".agent/tasks.json";

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

  const existingRecoveryTask = tasks.find(
    (task) =>
      task.recoveryOfTaskId === failedTask.id &&
      ["todo", "running", "pending-pr"].includes(task.status)
  );

  if (existingRecoveryTask) {
    await logActivity({
      type: "recovery-task-duplicate-blocked",
      runId: existingRecoveryTask.id,
      taskId: failedTask.id,
      agentName: "Senior Recovery Agent",
      reason,
    });

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
    agentRole: "senior-recovery",
    agentName: "Senior Recovery Agent",
    recoveryOfTaskId: failedTask.id,
    recoveryReason: reason,
    plannerNotes:
      "Automatically generated recovery task after reviewer/execution failure.",
  };

  tasks.unshift(recoveryTask);

  await writeTasksFile(tasks, sha, `Create recovery task for ${failedTask.id}`);

  await logActivity({
    type: "recovery-task-created",
    runId: recoveryTask.id,
    taskId: failedTask.id,
    agentName: "Senior Recovery Agent",
    reason,
  });

  return recoveryTask;
}
