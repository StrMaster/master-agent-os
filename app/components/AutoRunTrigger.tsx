'use client';

import { useState } from 'react';

type AutoRunResult = {
  ok?: boolean;
  mode?: string;
  message?: string;
  error?: string;
  runner?: {
    ok?: boolean;
    mode?: string;
    taskId?: string;
    branchName?: string;
    pullRequestUrl?: string;
    message?: string;
    error?: string;
  };
};

export default function AutoRunTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoRunResult | null>(null);

  async function runAutoCycle() {
    try {
      setLoading(true);
      setResult(null);

      const res = await fetch('/api/auto-run', {
        method: 'POST',
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        mode: 'auto-run-ui-failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <div className="text-sm font-medium uppercase tracking-wide text-emerald-300">
          Auto-run Test
        </div>

        <h2 className="mt-2 text-xl font-semibold text-white">
          Run Auto Cycle
        </h2>

        <p className="mt-2 text-sm text-white/60">
          Manually trigger one protected auto-run cycle through the auto-run API.
        </p>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={runAutoCycle}
        className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Running auto-cycle...' : 'Run auto-cycle'}
      </button>

      {result && (
        <div className="mt-5 rounded-xl border border-white/10 bg-neutral-950/60 p-4 text-sm text-white/70">
          <div>Mode: {result.mode ?? 'unknown'}</div>
          <div>Status: {result.ok ? 'OK' : 'Blocked / failed'}</div>

          {result.message && <div>Message: {result.message}</div>}
          {result.error && <div>Error: {result.error}</div>}

          {result.runner && (
            <div className="mt-3 space-y-1">
              <div>Runner mode: {result.runner.mode ?? 'unknown'}</div>
              {result.runner.taskId && <div>Task: {result.runner.taskId}</div>}
              {result.runner.branchName && (
                <div>Branch: {result.runner.branchName}</div>
              )}

              {result.runner.pullRequestUrl && (
                <a
                  href={result.runner.pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-blue-300 underline underline-offset-4 hover:text-blue-200"
                >
                  Open pull request
                </a>
              )}

              {result.runner.message && <div>{result.runner.message}</div>}
              {result.runner.error && <div>Error: {result.runner.error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}