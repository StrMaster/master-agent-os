'use client';

import { useEffect, useMemo, useState } from 'react';

type RuntimeTask = {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'pending-pr' | 'completed' | 'failed';
};

type RuntimeHealth = {
  status: 'healthy' | 'degraded' | 'blocked';
  consecutiveFailures: number;
  runtimeBlockedUntil?: string;
  runnerLocked: boolean;
  recoveryActive: boolean;
  lastRunAt?: number;
};

export default function RuntimeOverview() {
  const [tasks, setTasks] = useState<RuntimeTask[]>([]);
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRuntimeState() {
    try {
      const res = await fetch('/api/runtime-state', {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to load runtime state');
      }

      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      if (data.health) setHealth(data.health);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load runtime state',
      );
    }
  }

  useEffect(() => {
    loadRuntimeState();

    const interval = window.setInterval(loadRuntimeState, 10_000);

    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      queued: tasks.filter((task) => task.status === 'queued').length,
      running: tasks.filter((task) => task.status === 'running').length,
      pendingPr: tasks.filter((task) => task.status === 'pending-pr').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
    };
  }, [tasks]);

  return (
    <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
      {health && health.status !== 'healthy' && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          health.status === 'blocked'
            ? 'border-red-500/30 bg-red-500/10 text-red-200'
            : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
        }`}>
          <span className="font-semibold">
            {health.status === 'blocked' ? '🔴 Runtime blocked' : '🟡 Runner degraded'}
          </span>
          {health.consecutiveFailures > 0 && (
            <span className="ml-2 text-white/50">{health.consecutiveFailures} consecutive failures</span>
          )}
          {health.runtimeBlockedUntil && (
            <span className="ml-2 text-white/50">
              blocked until {new Date(health.runtimeBlockedUntil).toLocaleTimeString()}
            </span>
          )}
          {health.recoveryActive && (
            <span className="ml-2 text-white/50">· recovery mode active</span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Live Runtime
          </p>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${
              !health ? 'bg-zinc-500' :
              health.status === 'healthy' ? 'bg-emerald-400' :
              health.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            <span className="text-xs text-zinc-500">
              {!health ? 'loading' : health.status}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Runner State
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Live task status from the runtime-state API.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <RuntimeStat label="Total" value={stats.total} />
        <RuntimeStat label="Queued" value={stats.queued} />
        <RuntimeStat label="Running" value={stats.running} />
        <RuntimeStat label="Pending PR" value={stats.pendingPr} />
        <RuntimeStat label="Failed" value={stats.failed} />
        <RuntimeStat label="Completed" value={stats.completed} />
      </div>
    </div>
  );
}

function RuntimeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
