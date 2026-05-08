export type ExecutionWaveTask = {
  id: string;

  title: string;

  summary: string;

  targetFile: string;

  priority:
    | "low"
    | "medium"
    | "high";

  dependsOn: string[];

  status:
    | "queued"
    | "waiting"
    | "running"
    | "completed";

  wave: number;
};

export function buildExecutionWaves(
  tasks: ExecutionWaveTask[]
) {
  const resolved:
    ExecutionWaveTask[] = [];

  for (const task of tasks) {
    const dependencyCount =
      task.dependsOn?.length || 0;

    resolved.push({
      ...task,

      status:
        dependencyCount > 0
          ? "waiting"
          : "queued",

      wave: dependencyCount,
    });
  }

  return resolved.sort(
    (a, b) => a.wave - b.wave
  );
}