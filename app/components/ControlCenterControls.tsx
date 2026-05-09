'use client';

import { useEffect, useState } from 'react';

type ControlState = {
  paused: boolean;
  autoRunEnabled: boolean;
  autoMergeEnabled: boolean;
  emergencyStop: boolean;
};

export default function ControlCenterControls() {
  const [state, setState] = useState<ControlState | null>(null);
  const [loading, setLoading] = useState(false);
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

  async function updateState(patch: Partial<ControlState>) {
    try {
      setLoading(true);

      const res = await fetch('/api/control-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to update control state');
      }

      setState(data.state);
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

  if (!state) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
        Loading control state...
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <div className="text-sm font-medium uppercase tracking-wide text-purple-300">
          Control State
        </div>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Autonomous Controls
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Control auto-run, auto-merge, pause mode, and emergency stop.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ControlToggle
          label="Auto-run"
          active={state.autoRunEnabled}
          disabled={loading || state.emergencyStop}
          onClick={() => updateState({ autoRunEnabled: !state.autoRunEnabled })}
        />

        <ControlToggle
          label="Auto-merge"
          active={state.autoMergeEnabled}
          disabled={loading || state.emergencyStop}
          onClick={() =>
            updateState({ autoMergeEnabled: !state.autoMergeEnabled })
          }
        />

        <ControlToggle
          label="Paused"
          active={state.paused}
          disabled={loading}
          onClick={() => updateState({ paused: !state.paused })}
        />

        <ControlToggle
          label="Emergency stop"
          active={state.emergencyStop}
          danger
          disabled={loading}
          onClick={() =>
            updateState({
              emergencyStop: !state.emergencyStop,
              autoRunEnabled: state.emergencyStop ? state.autoRunEnabled : false,
              autoMergeEnabled: state.emergencyStop
                ? state.autoMergeEnabled
                : false,
            })
          }
        />
      </div>
    </div>
  );
}

function ControlToggle({
  label,
  active,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-xl border px-4 py-3 text-left text-sm transition',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10',
        active
          ? danger
            ? 'border-red-500/30 bg-red-500/10 text-red-200'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-white/10 bg-neutral-950/50 text-white/60',
      ].join(' ')}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs opacity-70">{active ? 'ON' : 'OFF'}</div>
    </button>
  );
}