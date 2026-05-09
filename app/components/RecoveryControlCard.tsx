'use client';

import { useEffect, useState } from 'react';

type RecoveryState = {
  recoveryActive: boolean;
  recentFailedRuns: number;
  recentValidationFailures: number;
  recentMergeFailures: number;
  recentDeployFailures: number;
};

export default function RecoveryControlCard() {
  const [state, setState] = useState<RecoveryState | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadState() {
    const res = await fetch('/api/control-state', {
      cache: 'no-store',
    });

    const data = await res.json();

    if (data?.state) {
      setState(data.state);
    }
  }

  async function clearRecovery() {
    try {
      setLoading(true);

      const res = await fetch('/api/control-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clearRecovery: true,
        }),
      });

      const data = await res.json();

      if (data?.state) {
        setState(data.state);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();

    const interval = window.setInterval(loadState, 15000);

    return () => window.clearInterval(interval);
  }, []);

  if (!state) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-orange-300">
            Recovery Intelligence
          </div>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Recovery State
          </h2>

          <p className="mt-2 text-sm text-white/60">
            Runtime protection and failure escalation state.
          </p>
        </div>

        <div
          className={[
            'rounded-xl border px-3 py-2 text-sm',
            state.recoveryActive
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
          ].join(' ')}
        >
          {state.recoveryActive
            ? 'Recovery mode active'
            : 'Recovery system healthy'}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RecoveryStat
          label="Failed runs"
          value={state.recentFailedRuns}
        />

        <RecoveryStat
          label="Validation failures"
          value={state.recentValidationFailures}
        />

        <RecoveryStat
          label="Merge failures"
          value={state.recentMergeFailures}
        />

        <RecoveryStat
          label="Deploy failures"
          value={state.recentDeployFailures}
        />
      </div>

      {state.recoveryActive && (
        <button
          type="button"
          disabled={loading}
          onClick={clearRecovery}
          className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear recovery mode
        </button>
      )}
    </div>
  );
}

function RecoveryStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}