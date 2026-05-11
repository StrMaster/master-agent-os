"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import ApprovePlannerWaveButton from "./ApprovePlannerWaveButton";
import ApprovePreviewTaskButton from "./ApprovePreviewTaskButton";

type WorkspaceTask = {
  id: string;
  title?: string;
  summary?: string;
  status?: string;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  wave?: number;
  waveStatus?: "ready" | "blocked" | "completed";
  targetFile?: string;
  parentTaskId?: string;
  plannerNotes?: string;
  result?: {
    merged?: boolean;
    pullRequestUrl?: string;
  };
  error?: string;
};

type WorkspaceActivity = {
  id: string;
  timestamp: string;
  type: string;
  summary?: string;
  reason?: string;
  message?: string;
  taskId?: string;
  runId?: string;
  agentName?: string;
  agentRole?: string;
  wave?: number;
};

type ControlState = {
  paused?: boolean;
  autoRunEnabled?: boolean;
  emergencyStop?: boolean;
  recoveryActive?: boolean;
  runnerHealthStatus?: "healthy" | "degraded" | "blocked";
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  runtimeBlockedUntil?: string;
  deployStatus?: "pending" | "success" | "failed";
  overnightModeActive?: boolean;
  deployError?: string;
};

type ApprovalExecutionCenterProps = {
  tasks: WorkspaceTask[];
  activity?: WorkspaceActivity[];
};

export default function ApprovalExecutionCenter({
  tasks,
  activity = [],
}: ApprovalExecutionCenterProps) {
  const [state, setState] = useState<ControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadState() {
    try {
      const res = await fetch("/api/control-state", { cache: "no-store" });
      const data = await res.json();

      if (data?.ok && data.state) {
        setState(data.state);
      }
    } catch {
      // Keep the center usable if control-state is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();

    const interval = window.setInterval(loadState, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const derived = useMemo(() => {
    const pendingApprovalTasks = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.status !== "completed" &&
        task.result?.merged !== true &&
        (task.previewOnly || task.requiresApproval)
    );

    const waveGroups = groupWaveApprovals(tasks);
    const runningTasks = tasks.filter((task) => task.status === "running");
    const latestEvent = [...activity].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    const blockedReasons = buildBlockedReasons(state);
    const runtimeMode = buildRuntimeMode(state);

    return {
      pendingApprovalTasks,
      waveGroups,
      runningTasks,
      latestEvent,
      blockedReasons,
      runtimeMode,
    };
  }, [activity, state, tasks]);

  async function togglePaused() {
    if (!state) {
      return;
    }

    try {
      setWorking(true);

      const res = await fetch("/api/control-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !state.paused }),
      });

      const data = await res.json();

      if (data?.ok && data.state) {
        setState(data.state);
      }
    } finally {
      setWorking(false);
    }
  }

  const statusFlags = [
    {
      label: "Waiting approval",
      active: derived.pendingApprovalTasks.length > 0,
      tone: derived.pendingApprovalTasks.length > 0 ? "approval" : "muted",
    },
    {
      label: "Executing",
      active: derived.runningTasks.length > 0 || Boolean(state?.runnerLocked),
      tone: "success",
    },
    {
      label: "Blocked",
      active: derived.blockedReasons.length > 0,
      tone: derived.blockedReasons.length > 0 ? "blocked" : "muted",
    },
    {
      label: "Paused",
      active: Boolean(state?.paused),
      tone: state?.paused ? "warning" : "muted",
    },
    {
      label: "Recovery active",
      active: Boolean(state?.recoveryActive),
      tone: state?.recoveryActive ? "recovery" : "muted",
    },
  ] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              Approval & Execution Center
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Planner and runtime control workspace
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Centralized approvals, wave gates, runtime mode, execution session, and safe pause/resume controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusChip tone={statusTone(derived.runtimeMode)}>
              {derived.runtimeMode}
            </StatusChip>
            {state?.runnerHealthStatus && (
              <StatusChip tone={healthTone(state.runnerHealthStatus)}>
                {state.runnerHealthStatus}
              </StatusChip>
            )}
            {state?.overnightModeActive && (
              <StatusChip tone="warning">Overnight</StatusChip>
            )}
            {state?.deployStatus && (
              <StatusChip tone={deployTone(state.deployStatus)}>
                Deploy {state.deployStatus}
              </StatusChip>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statusFlags.map((flag) => (
            <FlagPill key={flag.label} label={flag.label} active={flag.active} tone={flag.tone} />
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <MetricCard
            label="Pending approvals"
            value={derived.pendingApprovalTasks.length}
            hint="Tasks waiting on approval gates"
          />
          <MetricCard
            label="Wave approvals"
            value={derived.waveGroups.length}
            hint="Planner waves ready for operator review"
          />
          <MetricCard
            label="Active execution"
            value={derived.runningTasks.length}
            hint="Tasks currently in flight"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Runtime Mode</h3>
              <p className="mt-1 text-sm text-white/50">
                Current runtime state and immediate blockers.
              </p>
            </div>
            <StatusChip tone={state?.paused ? "warning" : "success"}>
              {state?.paused ? "Paused" : "Running"}
            </StatusChip>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailCard label="Runner health" value={state?.runnerHealthStatus ?? "healthy"} />
            <DetailCard label="Execution session" value={sessionLabel(state)} />
            <DetailCard label="Auto-run" value={state?.autoRunEnabled ? "Enabled" : "Disabled"} />
            <DetailCard label="Emergency stop" value={state?.emergencyStop ? "On" : "Off"} />
            <DetailCard label="Recovery" value={state?.recoveryActive ? "Active" : "Clear"} />
            <DetailCard label="Blocked until" value={state?.runtimeBlockedUntil ? new Date(state.runtimeBlockedUntil).toLocaleString() : "None"} />
          </div>

          {derived.blockedReasons.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-red-100/60">
                Blocked reasons
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {derived.blockedReasons.map((reason) => (
                  <ReasonChip key={reason} reason={reason} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={togglePaused}
              disabled={loading || working}
              className={[
                "inline-flex items-center rounded-xl border px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                state?.paused
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15",
              ].join(" ")}
            >
              {working ? "Updating..." : state?.paused ? "Resume runtime" : "Pause runtime"}
            </button>

            <StatusChip tone="neutral">
              {state?.runnerLocked ? "Session locked" : "Session idle"}
            </StatusChip>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Execution Session</h3>
              <p className="mt-1 text-sm text-white/50">
                Running tasks and the latest orchestration signal.
              </p>
            </div>
            <MetricCard
              label="Running"
              value={derived.runningTasks.length}
              hint="Live execution count"
            />
          </div>

          <div className="mt-4 space-y-3">
            {derived.runningTasks.length === 0 ? (
              <EmptyState
                title="No active session"
                body="Nothing is currently executing. Approved tasks will appear here when the runner starts."
              />
            ) : (
              derived.runningTasks.slice(0, 3).map((task) => (
                <TaskRow key={task.id} task={task} />
              ))
            )}
          </div>

          {derived.latestEvent && (
            <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
                Latest orchestration event
              </div>
              <div className="mt-2 text-sm font-medium text-cyan-50">
                {derived.latestEvent.type}
              </div>
              <div className="mt-1 text-sm text-cyan-50/75">
                {derived.latestEvent.summary ?? derived.latestEvent.reason ?? derived.latestEvent.message ?? "No summary available."}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xl font-semibold text-white">Pending approvals</h3>
          <p className="mt-1 text-sm text-white/50">
            Preview tasks and approval-required items waiting to be unlocked.
          </p>

          <div className="mt-4 space-y-3">
            {derived.pendingApprovalTasks.length === 0 ? (
              <EmptyState
                title="No pending approvals"
                body="Everything is currently approved or already in flight."
              />
            ) : (
              derived.pendingApprovalTasks.slice(0, 4).map((task) => (
                <ApprovalTaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xl font-semibold text-white">Wave approvals</h3>
          <p className="mt-1 text-sm text-white/50">
            Planner wave groups that can be approved together.
          </p>

          <div className="mt-4 space-y-3">
            {derived.waveGroups.length === 0 ? (
              <EmptyState
                title="No wave approvals"
                body="No planner wave is currently waiting on review."
              />
            ) : (
              derived.waveGroups.slice(0, 4).map((wave) => (
                <WaveCard key={wave.waveKey} wave={wave} />
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function groupWaveApprovals(tasks: WorkspaceTask[]) {
  const map = new Map<
    string,
    { waveKey: string; wave?: number; tasks: WorkspaceTask[] }
  >();

  for (const task of tasks) {
    if (typeof task.wave !== "number") {
      continue;
    }

    if (
      task.status === "done" ||
      task.status === "completed" ||
      task.result?.merged === true
    ) {
      continue;
    }

    const needsApproval =
      Boolean(task.previewOnly) || Boolean(task.requiresApproval) || task.waveStatus === "blocked" || task.waveStatus === "ready";

    if (!needsApproval) {
      continue;
    }

    const waveKey = `wave-${task.wave}`;
    const existing = map.get(waveKey);

    if (existing) {
      existing.tasks.push(task);
      continue;
    }

    map.set(waveKey, {
      waveKey,
      wave: task.wave,
      tasks: [task],
    });
  }

  return [...map.values()].sort((left, right) => {
    const leftWave = left.wave ?? 0;
    const rightWave = right.wave ?? 0;
    return leftWave - rightWave;
  });
}

function buildBlockedReasons(state: ControlState | null) {
  const reasons: string[] = [];

  if (!state) {
    return reasons;
  }

  if (state.emergencyStop) {
    reasons.push("Emergency stop enabled");
  }

  if (state.paused) {
    reasons.push("Runtime paused");
  }

  if (state.recoveryActive) {
    reasons.push("Recovery flow active");
  }

  if (state.runnerHealthStatus === "blocked") {
    reasons.push("Runner health blocked");
  }

  if (state.runtimeBlockedUntil) {
    reasons.push(`Blocked until ${new Date(state.runtimeBlockedUntil).toLocaleString()}`);
  }

  if (state.deployStatus === "failed") {
    reasons.push("Deploy failure active");
  }

  return reasons;
}

function buildRuntimeMode(state: ControlState | null) {
  if (!state) {
    return "unknown";
  }

  if (state.emergencyStop) {
    return "emergency stop";
  }

  if (state.paused) {
    return "paused";
  }

  if (state.recoveryActive) {
    return "recovery";
  }

  if (state.runtimeBlockedUntil) {
    return "blocked";
  }

  if (state.overnightModeActive) {
    return "overnight";
  }

  if (state.autoRunEnabled) {
    return "active";
  }

  return "idle";
}

function sessionLabel(state: ControlState | null) {
  if (!state) {
    return "unknown";
  }

  if (state.runnerLocked) {
    return "running";
  }

  if (state.lastRunAt) {
    return `last run ${new Date(state.lastRunAt).toLocaleString()}`;
  }

  return "idle";
}

function statusTone(value: string) {
  if (value === "blocked" || value === "paused" || value === "emergency stop") {
    return "blocked";
  }

  if (value === "recovery") {
    return "recovery";
  }

  if (value === "overnight") {
    return "deploy";
  }

  if (value === "active" || value === "running") {
    return "success";
  }

  if (value === "idle" || value === "unknown") {
    return "neutral";
  }

  return "warning";
}

function healthTone(value: "healthy" | "degraded" | "blocked") {
  if (value === "blocked") {
    return "blocked";
  }

  if (value === "degraded") {
    return "warning";
  }

  return "success";
}

function deployTone(value?: "pending" | "success" | "failed") {
  if (value === "failed") {
    return "blocked";
  }

  if (value === "pending") {
    return "warning";
  }

  return "deploy";
}

function ApprovalTaskCard({ task }: { task: WorkspaceTask }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {task.title ?? "Untitled task"}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {task.status ?? "unknown"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {task.previewOnly && <StatusChip tone="approval">Preview</StatusChip>}
          {task.requiresApproval && (
            <StatusChip tone="approval">Approval required</StatusChip>
          )}
        </div>
      </div>

      {task.summary && (
        <p className="mt-3 text-sm leading-6 text-white/65">{task.summary}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {task.targetFile && <MiniChip>{task.targetFile}</MiniChip>}
        {task.wave !== undefined && <MiniChip>Wave {task.wave}</MiniChip>}
        {task.waveStatus && <MiniChip>{task.waveStatus}</MiniChip>}
        {task.parentTaskId && <MiniChip>Parent {task.parentTaskId}</MiniChip>}
      </div>

      {task.plannerNotes && (
        <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-sm text-purple-100/80">
          {task.plannerNotes}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(task.previewOnly || task.requiresApproval) && (
          <ApprovePreviewTaskButton taskId={task.id} />
        )}
      </div>
    </article>
  );
}

function WaveCard({ wave }: { wave: { waveKey: string; wave?: number; tasks: WorkspaceTask[] } }) {
  const primaryTask = wave.tasks[0];

  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            Wave {wave.wave ?? "?"}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            {wave.tasks.length} tasks
          </div>
        </div>
        <StatusChip tone="approval">Wave approval</StatusChip>
      </div>

      <div className="mt-3 space-y-2">
        {wave.tasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75"
          >
            {task.title ?? task.targetFile ?? task.id}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ApprovePlannerWaveButton taskId={primaryTask.id} />
        {wave.tasks.some((task) => task.requiresApproval) && (
          <StatusChip tone="approval-required">Approval gated</StatusChip>
        )}
      </div>
    </article>
  );
}

function TaskRow({ task }: { task: WorkspaceTask }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {task.title ?? "Untitled task"}
          </div>
          <div className="mt-1 text-xs text-white/40">
            {task.targetFile ?? "No target file"}
          </div>
        </div>
        <StatusChip tone="success">Executing</StatusChip>
      </div>
      {task.summary && (
        <p className="mt-3 text-sm leading-6 text-white/65">{task.summary}</p>
      )}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-sm text-white/80">{value}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/50">{hint}</div>
    </div>
  );
}

function FlagPill({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: "approval" | "success" | "blocked" | "warning" | "recovery" | "muted";
}) {
  const toneClasses = {
    approval: "border-violet-500/30 bg-violet-500/10 text-violet-100",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    blocked: "border-red-500/30 bg-red-500/10 text-red-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    recovery: "border-orange-500/30 bg-orange-500/10 text-orange-100",
    muted: "border-white/10 bg-white/5 text-white/60",
  }[tone];

  return (
    <div
      className={[
        "inline-flex items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-sm",
        active ? toneClasses : "border-white/10 bg-neutral-950/50 text-white/50",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs uppercase tracking-[0.18em]">
        {active ? "On" : "Off"}
      </span>
    </div>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "blocked" | "recovery" | "approval" | "approval-required" | "deploy" | "neutral";
}) {
  const classes = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    blocked: "border-red-500/30 bg-red-500/10 text-red-100",
    recovery: "border-orange-500/30 bg-orange-500/10 text-orange-100",
    approval: "border-violet-500/30 bg-violet-500/10 text-violet-100",
    "approval-required": "border-violet-500/30 bg-violet-500/10 text-violet-100",
    deploy: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    neutral: "border-white/10 bg-white/5 text-white/70",
  }[tone];

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        classes,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function MiniChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-1 text-sm text-white/50">{body}</div>
    </div>
  );
}

function ReasonChip({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-100">
      {reason}
    </span>
  );
}
