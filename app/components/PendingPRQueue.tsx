'use client';

import { useEffect, useState } from 'react';

type PendingTask = {
  id?: string;
  title?: string;
  status?: string;
  branchName?: string;
  executionMode?: string;
  riskLevel?: string;
  wave?: number;
  parentTaskId?: string;
  plannerNotes?: string;
  result?: {
    pullRequestUrl?: string;
    merged?: boolean;
  };
};

type BuildStatus = "success" | "failure" | "pending" | "unknown";

export default function PendingPRQueue() {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);
  const [buildStatuses, setBuildStatuses] = useState<Record<string, BuildStatus>>({});

  async function loadPendingPRs() {
    try {
      const res = await fetch('/api/pending-prs', {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ?? 'Failed to load pending PR queue'
        );
      }

      const newTasks = Array.isArray(data.pending) ? data.pending : [];
      setTasks(newTasks);
      setError(null);
      // Fetch build status for each task with a branch
      newTasks.forEach((t: PendingTask) => {
        if (t.branchName) fetchBuildStatus(t.branchName);
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load pending PR queue'
      );
    }
  }

  async function fetchBuildStatus(branch: string) {
    try {
      const res = await fetch(`/api/pr-build-status?branch=${encodeURIComponent(branch)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setBuildStatuses((prev) => ({ ...prev, [branch]: data.status as BuildStatus }));
      }
    } catch {
      // ignore
    }
  }

async function createPlannerWaves(taskId?: string) {
  if (!taskId) return;

  try {
    setPlannerMessage(null);

    const res = await fetch('/api/planner-waves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? 'Failed to create planner waves');
    }

    setPlannerMessage(
      data.mode === 'planner-waves-exist'
        ? 'Planner waves already exist.'
        : 'Planner waves created.'
    );

    await loadPendingPRs();
  } catch (err) {
    setPlannerMessage(
      err instanceof Error ? err.message : 'Failed to create planner waves'
    );
  }
}

  useEffect(() => {
    loadPendingPRs();

    const interval = window.setInterval(
      loadPendingPRs,
      15000
    );

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <div className="text-sm font-medium uppercase tracking-wide text-pink-300">
          Pending PR Queue
        </div>

        <h2 className="mt-2 text-xl font-semibold text-white">
          Active Execution Queue
        </h2>

        <p className="mt-2 text-sm text-white/60">
          Running tasks and pull requests waiting for review.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {plannerMessage && (
  <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
    {plannerMessage}
  </div>
)}

      {!error && tasks.length === 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-white/50">
          No active execution tasks.
        </div>
      )}

      <div className="mt-4 space-y-3">
        {tasks.map((task, index) => (
          <div
            key={task.id ?? index}
            className="rounded-xl border border-white/10 bg-neutral-950/50 p-4"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  {task.title ?? 'Untitled task'}
                </div>

                <div className="mt-2 text-xs text-white/50">
                  Status: {task.status ?? 'unknown'}
                </div>

                {typeof task.wave === 'number' && (
  <div className="mt-1 text-xs text-white/50">
    Wave: {task.wave}
  </div>
)}

{task.parentTaskId && (
  <div className="mt-1 text-xs text-white/50">
    Parent task: {task.parentTaskId}
  </div>
)}

{task.plannerNotes && (
  <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-xs text-purple-100/80">
    {task.plannerNotes}
  </div>
)}

                {task.branchName && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                    <span>Branch: {task.branchName}</span>
                    {buildStatuses[task.branchName] === 'success' && (
                      <span title="Build passed" className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                    {buildStatuses[task.branchName] === 'failure' && (
                      <span title="Build failed" className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    )}
                    {buildStatuses[task.branchName] === 'pending' && (
                      <span title="Build running" className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                    )}
                  </div>
                )}
              </div>

                {task.status === 'planner-split' && (
  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs text-purple-200">
    Split into waves
  </div>
)}

              <div className="flex items-center gap-2">
                {task.result?.merged ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                    Merged
                  </div>
                ) : (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                    Pending
                  </div>
                )}

                {task.result?.pullRequestUrl && (
                  <a
                    href={task.result.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-300 underline underline-offset-4 hover:text-blue-200"
                  >
                    Open PR
                  </a>
                )}
                  {(task.status === 'planner-required' ||
  task.executionMode === 'multi-step' ||
  task.riskLevel === 'high') && (
  <button
    type="button"
    onClick={() => createPlannerWaves(task.id)}
    className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs text-purple-200 hover:bg-purple-500/20"
  >
    Create waves
  </button>
)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}