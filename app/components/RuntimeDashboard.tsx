"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type DashboardTask = {
  id: string;
  title?: string;
  status?: string;
  targetFile?: string;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  wave?: number;
  waveStatus?: "ready" | "blocked" | "completed";
  parentTaskId?: string;
  result?: {
    merged?: boolean;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
  };
};

type DashboardActivity = {
  id: string;
  timestamp: string;
  type: string;
  taskId?: string;
  summary?: string;
  reason?: string;
  targetFile?: string;
  runId?: string;
};

type ControlState = {
  runnerHealthStatus?: "healthy" | "degraded" | "blocked";
  paused?: boolean;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
  recoveryActive?: boolean;
  runtimeBlockedUntil?: string;
  deployStatus?: "pending" | "success" | "failed";
  deployError?: string;
  lastDeployUrl?: string;
  lastRunAt?: number;
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  consecutiveFailures?: number;
  failedRuns?: number;
  overnightModeActive?: boolean;
  overnightTasksCompleted?: number;
  overnightFailures?: number;
  overnightRecoveries?: number;
  overnightPrsCreated?: number;
};

export default function RuntimeDashboard({
  tasks,
  activity,
}: {
  tasks: DashboardTask[];
  activity: DashboardActivity[];
}) {
  const [state, setState] = useState<ControlState | null>(null);

  async function loadState() {
    try {
      const res = await fetch("/api/control-state", { cache: "no-store" });
      const data = await res.json();

      if (data?.ok && data.state) {
        setState(data.state);
      }
    } catch {
      // Keep the dashboard usable even if control-state is unavailable.
    }
  }

  useEffect(() => {
    loadState();

    const interval = window.setInterval(loadState, 10_000);

    return () => window.clearInterval(interval);
  }, []);

  const derived = useMemo(() => {
    const running = tasks.filter((task) => task.status === "running");
    const pendingApprovals = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "completed" &&
        !task.result?.merged &&
        (task.previewOnly || task.requiresApproval)
    );
    const recoveryTasks = tasks.filter(
      (task) =>
        task.status === "failed" ||
        task.parentTaskId ||
        Boolean(task.wave)
    );

    return {
      running,
      pendingApprovals,
      recoveryTasks,
      recentActivity: activity.slice(0, 5),
    };
  }, [activity, tasks]);

  const health = state?.runnerHealthStatus ?? "healthy";
  const paused = state?.paused ?? false;
  const recoveryActive = state?.recoveryActive ?? false;
  const overnightModeActive = state?.overnightModeActive ?? false;
  const blockedUntil = state?.runtimeBlockedUntil;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardCard
          eyebrow="Runner Health"
          title="Runner Health"
          status={health}
          statusTone={healthTone(health)}
        >
          <MetricLine label="Consecutive failures" value={state?.consecutiveFailures ?? 0} />
          <MetricLine label="Failed runs" value={state?.failedRuns ?? 0} />
          {blockedUntil && (
            <MetricLine
              label="Blocked until"
              value={new Date(blockedUntil).toLocaleString()}
            />
          )}
        </DashboardCard>

        <DashboardCard
          eyebrow="Runtime State"
          title="Runtime State"
          status={paused ? "paused" : "active"}
          statusTone={paused ? "amber" : "emerald"}
        >
          <FlagRow label="Auto-run" value={state?.autoRunEnabled ? "On" : "Off"} />
          <FlagRow label="Auto-merge" value={state?.autoMergeEnabled ? "On" : "Off"} />
          <FlagRow label="Emergency stop" value={state?.emergencyStop ? "On" : "Off"} />
          <FlagRow label="Overnight mode" value={overnightModeActive ? "On" : "Off"} />
        </DashboardCard>

        <DashboardCard
          eyebrow="Active Session"
          title="Active Session"
          status={state?.runnerLocked ? "running" : "idle"}
          statusTone={state?.runnerLocked ? "cyan" : "slate"}
        >
          <MetricLine label="Running tasks" value={derived.running.length} />
          <MetricLine
            label="Last run"
            value={state?.lastRunAt ? new Date(state.lastRunAt).toLocaleString() : "—"}
          />
          <MetricLine
            label="Lock started"
            value={
              state?.runnerLockStartedAt
                ? new Date(state.runnerLockStartedAt).toLocaleString()
                : "—"
            }
          />
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardCard
          eyebrow="Pending Approvals"
          title="Pending Approvals"
          status={`${derived.pendingApprovals.length}`}
          statusTone="purple"
        >
          <TaskPreviewList tasks={derived.pendingApprovals.slice(0, 3)} empty="No approval gates right now." />
        </DashboardCard>

        <DashboardCard
          eyebrow="Recovery Status"
          title="Recovery Status"
          status={recoveryActive ? "active" : "clear"}
          statusTone={recoveryActive ? "red" : "emerald"}
        >
          <FlagRow label="Recovery active" value={recoveryActive ? "Yes" : "No"} />
          <MetricLine label="Failed runs" value={state?.failedRuns ?? 0} />
          <MetricLine label="Recoveries" value={state?.overnightRecoveries ?? 0} />
          <MetricLine label="Recovery tasks" value={derived.recoveryTasks.length} />
        </DashboardCard>

        <DashboardCard
          eyebrow="Deploy Status"
          title="Deploy Status"
          status={state?.deployStatus ?? "idle"}
          statusTone={deployTone(state?.deployStatus)}
        >
          <FlagRow label="Deploy status" value={state?.deployStatus ?? "idle"} />
          {state?.deployError && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
              {state.deployError}
            </p>
          )}
          {state?.lastDeployUrl && (
            <a
              className="text-sm text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
              href={state.lastDeployUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open latest deploy
            </a>
          )}
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard
          eyebrow="Recent Activity"
          title="Recent Activity"
          status={`${derived.recentActivity.length}`}
          statusTone="slate"
        >
          <div className="space-y-3">
            {derived.recentActivity.length === 0 ? (
              <p className="text-sm text-white/50">No recent activity yet.</p>
            ) : (
              derived.recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-white/10 bg-neutral-950/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {event.type}
                    </span>
                    {event.taskId && (
                      <span className="text-xs text-white/45">Task {event.taskId}</span>
                    )}
                  </div>
                  {event.summary && (
                    <div className="mt-1 text-sm text-white/60">{event.summary}</div>
                  )}
                  {event.reason && (
                    <div className="mt-1 text-xs text-white/45">{event.reason}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        <DashboardCard
          eyebrow="Execution Graph"
          title="Runtime Surface"
          status="ready"
          statusTone="cyan"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniPanel label="Approvals" value={derived.pendingApprovals.length} />
            <MiniPanel label="Recovery" value={recoveryActive ? 1 : 0} />
            <MiniPanel label="Overnight" value={overnightModeActive ? 1 : 0} />
            <MiniPanel label="Blocked" value={blockedUntil ? 1 : 0} />
          </div>
          <p className="mt-4 text-sm text-white/50">
            Future lanes for agent timeline, execution graph, mobile controls, and observability can attach here.
          </p>
        </DashboardCard>
      </div>
    </section>
  );
}

function DashboardCard({
  eyebrow,
  title,
  status,
  statusTone,
  children,
}: {
  eyebrow: string;
  title: string;
  status: string;
  statusTone: "emerald" | "amber" | "red" | "cyan" | "purple" | "slate";
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-white/40">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        </div>
        <StatusPill tone={statusTone}>{status}</StatusPill>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function FlagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-neutral-950/50 px-3 py-2 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function TaskPreviewList({
  tasks,
  empty,
}: {
  tasks: DashboardTask[];
  empty: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-white/50">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-xl border border-white/10 bg-neutral-950/50 p-3">
          <div className="text-sm font-medium text-white">
            {task.title ?? "Untitled task"}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {task.status ?? "unknown"}
            {task.wave ? ` · wave ${task.wave}` : ""}
            {task.waveStatus ? ` · ${task.waveStatus}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniPanel({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "red" | "cyan" | "purple" | "slate";
  children: ReactNode;
}) {
  const toneClasses: Record<
    "emerald" | "amber" | "red" | "cyan" | "purple" | "slate",
    string
  > = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    slate: "border-white/10 bg-neutral-950/50 text-white/60",
  };

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]",
        toneClasses[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function healthTone(status: string) {
  if (status === "blocked") return "red";
  if (status === "degraded") return "amber";
  return "emerald";
}

function deployTone(status?: string) {
  if (status === "failed") return "red";
  if (status === "pending") return "amber";
  if (status === "success") return "emerald";
  return "slate";
}
