"use client";

import { type ReactNode, useEffect, useState } from "react";

type ControlState = {
  paused?: boolean;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
  recoveryActive?: boolean;
  runnerHealthStatus?: "healthy" | "degraded" | "blocked";
  runtimeBlockedUntil?: string;
  overnightModeActive?: boolean;
  overnightSessionStartedAt?: string;
  overnightSessionCompletedAt?: string;
  overnightSessionStopReason?: string;
  lastRunAt?: number;
  runnerLocked?: boolean;
  deployStatus?: "pending" | "success" | "failed";
  deployError?: string;
};

type ControlStatePatch = Partial<ControlState> & {
  clearOvernightSession?: boolean;
  clearRecovery?: boolean;
};

export default function RuntimeControlPanel() {
  const [state, setState] = useState<ControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadState() {
    try {
      const res = await fetch('/api/control-state', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to load control state');
      }

      setState(data.state);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load state');
    }
  }

  async function updateState(patch: ControlStatePatch) {
    try {
      setLoading(true);

      setState((current) =>
        current ? { ...current, ...patch } : current
      );

      const res = await fetch('/api/control-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to update control state');
      }

      if (data.state) setState(data.state);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update state');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  const runtimeMode = buildRuntimeMode(state);
  const blockedReasons = buildBlockedReasons(state);
  const blocked = blockedReasons.length > 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              Runtime Control Panel
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Safe runtime operation
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Pause, resume, emergency stop, auto-run, and overnight mode controls with stable client-side runtime state.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={toneForState(runtimeMode)}>{runtimeMode}</StatusPill>
            <StatusPill tone={toneForHealth(state?.runnerHealthStatus)}>
              {state?.runnerHealthStatus ?? "healthy"}
            </StatusPill>
            {state?.recoveryActive && <StatusPill tone="recovery">Recovery active</StatusPill>}
            {state?.overnightModeActive && <StatusPill tone="warning">Overnight active</StatusPill>}
            {state?.runtimeBlockedUntil && (
              <StatusPill tone="blocked">Blocked</StatusPill>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
            Runtime control warning: {error}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Runner health"
            value={state?.runnerHealthStatus ?? "healthy"}
            hint="Execution safety signal"
          />
          <MetricCard
            label="Runtime mode"
            value={runtimeMode}
            hint="Current operating mode"
          />
          <MetricCard
            label="Cooldown / block"
            value={state?.runtimeBlockedUntil ? "Blocked" : "Clear"}
            hint={state?.runtimeBlockedUntil ? new Date(state.runtimeBlockedUntil).toLocaleString() : "No temporary block"}
          />
          <MetricCard
            label="Execution session"
            value={state?.runnerLocked ? "Active" : "Idle"}
            hint={state?.lastRunAt ? new Date(state.lastRunAt).toLocaleString() : "No recent run"}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusFlag label="Paused" active={Boolean(state?.paused)} />
          <StatusFlag label="Auto-run" active={Boolean(state?.autoRunEnabled)} />
          <StatusFlag label="Emergency stop" active={Boolean(state?.emergencyStop)} />
          <StatusFlag label="Overnight" active={Boolean(state?.overnightModeActive)} />
        </div>

        {blockedReasons.length > 0 && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-red-100/60">
              Blocked reasons
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {blockedReasons.map((reason) => (
                <ReasonChip key={reason} reason={reason} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Runtime controls</div>
                <div className="mt-1 text-sm text-white/50">
                  These controls respect approval, recovery, deploy, and health gates.
                </div>
              </div>
              <StatusPill tone={blocked ? "blocked" : "success"}>
                {blocked ? "blocked" : "ready"}
              </StatusPill>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ControlButton
                label={state?.paused ? "Resume runtime" : "Pause runtime"}
                active={Boolean(state?.paused)}
                tone={state?.paused ? "success" : "warning"}
                disabled={loading || working}
                onClick={() => updateState({ paused: !state?.paused })}
              />

              <ControlButton
                label={state?.autoRunEnabled ? "Auto-run on" : "Auto-run off"}
                active={Boolean(state?.autoRunEnabled)}
                tone="success"
                disabled={loading || working || Boolean(state?.emergencyStop)}
                onClick={() => updateState({ autoRunEnabled: !state?.autoRunEnabled })}
              />

              <ControlButton
                label={state?.overnightModeActive ? "Stop overnight" : "Start overnight"}
                active={Boolean(state?.overnightModeActive)}
                tone={state?.overnightModeActive ? "warning" : "success"}
                disabled={loading || working || Boolean(state?.emergencyStop)}
                onClick={() =>
                  updateState(
                    state?.overnightModeActive
                      ? {
                          overnightModeActive: false,
                          clearOvernightSession: true,
                        }
                      : {
                          overnightModeActive: true,
                        }
                  )
                }
              />

              <ControlButton
                label={state?.emergencyStop ? "Emergency stop on" : "Emergency stop off"}
                active={Boolean(state?.emergencyStop)}
                tone="blocked"
                disabled={loading || working}
                danger
                onClick={() =>
                  updateState({
                    emergencyStop: !state?.emergencyStop,
                    autoRunEnabled: state?.emergencyStop ? state?.autoRunEnabled : false,
                    autoMergeEnabled: state?.emergencyStop ? state?.autoMergeEnabled : false,
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
            <div className="text-sm font-semibold text-white">Operational summary</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DetailRow label="Recovery" value={state?.recoveryActive ? "Active" : "Clear"} />
              <DetailRow label="Auto-merge" value={state?.autoMergeEnabled ? "Enabled" : "Disabled"} />
              <DetailRow
                label="Overnight session"
                value={state?.overnightSessionStartedAt ? "In progress" : "Not started"}
              />
              <DetailRow
                label="Deploy"
                value={state?.deployStatus ?? "idle"}
              />
              <DetailRow
                label="Deploy error"
                value={state?.deployError ?? "None"}
              />
              <DetailRow
                label="Blocked until"
                value={state?.runtimeBlockedUntil ? new Date(state.runtimeBlockedUntil).toLocaleString() : "None"}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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

function toneForState(value: string): "success" | "warning" | "blocked" | "recovery" | "neutral" {
  if (value === "emergency stop" || value === "blocked") {
    return "blocked";
  }

  if (value === "paused") {
    return "warning";
  }

  if (value === "recovery") {
    return "recovery";
  }

  if (value === "active" || value === "running") {
    return "success";
  }

  return "neutral";
}

function toneForHealth(value?: "healthy" | "degraded" | "blocked") {
  if (value === "blocked") {
    return "blocked";
  }

  if (value === "degraded") {
    return "warning";
  }

  return "success";
}

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "blocked" | "recovery" | "neutral";
}) {
  const classes = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    blocked: "border-red-500/30 bg-red-500/10 text-red-100",
    recovery: "border-orange-500/30 bg-orange-500/10 text-orange-100",
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

function StatusFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={[
        "inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-white/10 bg-neutral-950/50 text-white/55",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs uppercase tracking-[0.18em]">
        {active ? "On" : "Off"}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/50">{hint}</div>
    </div>
  );
}

function ControlButton({
  label,
  active,
  tone,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "success" | "warning" | "blocked";
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const classes = danger
    ? "border-red-500/30 bg-red-500/10 text-red-100"
    : tone === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
        disabled ? "opacity-60" : "hover:bg-white/10",
        active ? classes : "border-white/10 bg-neutral-950/50 text-white/65",
      ].join(" ")}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.18em] opacity-70">
        {active ? "on" : "off"}
      </div>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className="mt-1 text-sm text-white/80">{value}</div>
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
