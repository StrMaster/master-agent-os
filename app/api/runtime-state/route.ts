import { NextResponse } from "next/server";
import { getRuntimeTasks } from "@/app/lib/task-runtime";
import { readStateFile, summarizeRunnerHealth } from "@/app/api/agent-runner/state";

export async function GET() {
  const tasks = getRuntimeTasks();

  let health: {
    status: "healthy" | "degraded" | "blocked";
    consecutiveFailures: number;
    runtimeBlockedUntil?: string;
    runnerLocked: boolean;
    recoveryActive: boolean;
    lastRunAt?: number;
  } = {
    status: "healthy",
    consecutiveFailures: 0,
    runnerLocked: false,
    recoveryActive: false,
  };

  try {
    const { state } = await readStateFile();
    health = {
      status: summarizeRunnerHealth(state),
      consecutiveFailures: state.consecutiveFailures ?? 0,
      runtimeBlockedUntil: state.runtimeBlockedUntil,
      runnerLocked: state.runnerLocked ?? false,
      recoveryActive: state.recoveryActive ?? false,
      lastRunAt: state.lastRunAt,
    };
  } catch {
    // health stays as healthy default
  }

  return NextResponse.json({ tasks, health });
}
