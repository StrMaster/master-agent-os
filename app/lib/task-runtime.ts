export type RuntimeTaskStatus =
  | "queued"
  | "running"
  | "pending-pr"
  | "completed"
  | "failed";

export type RuntimeTask = {
  id: string;
  title: string;
  status: RuntimeTaskStatus;
  dependencies?: string[];
  branchName?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  pendingPrAt?: string;
  completedAt?: string;
  failedAt?: string;
};

let runtimeTasks: RuntimeTask[] = [];

export function getRuntimeTasks() {
  return runtimeTasks;
}

export function setRuntimeTasks(tasks: RuntimeTask[]) {
  runtimeTasks = tasks;
}

export function addRuntimeTask(task: Omit<RuntimeTask, "createdAt" | "status"> & {
  status?: RuntimeTaskStatus;
}) {
  const newTask: RuntimeTask = {
    ...task,
    status: task.status ?? "queued",
    createdAt: new Date().toISOString(),
  };

  runtimeTasks = [newTask, ...runtimeTasks];

  return newTask;
}

export function updateRuntimeTask(
  taskId: string,
  patch: Partial<Omit<RuntimeTask, "id" | "createdAt">>,
) {
  runtimeTasks = runtimeTasks.map((task) =>
    task.id === taskId ? { ...task, ...patch } : task,
  );

  return runtimeTasks.find((task) => task.id === taskId);
}

export function markRuntimeTaskRunning(taskId: string) {
  return updateRuntimeTask(taskId, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });
}

export function markRuntimeTaskPendingPr(
  taskId: string,
  input?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
  },
) {
  return updateRuntimeTask(taskId, {
    status: "pending-pr",
    branchName: input?.branchName,
    pullRequestUrl: input?.pullRequestUrl,
    pullRequestNumber: input?.pullRequestNumber,
    pendingPrAt: new Date().toISOString(),
    error: undefined,
  });
}

export function markRuntimeTaskCompleted(taskId: string) {
  return updateRuntimeTask(taskId, {
    status: "completed",
    completedAt: new Date().toISOString(),
    error: undefined,
  });
}

export function markRuntimeTaskFailed(taskId: string, error?: string) {
  return updateRuntimeTask(taskId, {
    status: "failed",
    error: error ?? "Task failed",
    failedAt: new Date().toISOString(),
  });
}

export function areDependenciesComplete(task: RuntimeTask) {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }

  return task.dependencies.every((dependencyId) => {
    const dependency = runtimeTasks.find((item) => item.id === dependencyId);

    return dependency?.status === "completed";
  });
}
