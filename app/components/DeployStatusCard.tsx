'use client';

import { useEffect, useState } from 'react';

type DeployStatus = {
  ok: boolean;
  deployment?: {
    id: string;
    state: string;
    url?: string;
    createdAt?: number;
  } | null;
  deployFailed?: boolean;
  error?: string;
};

export default function DeployStatusCard() {
  const [status, setStatus] = useState<DeployStatus | null>(null);

  async function loadDeployStatus() {
    try {
      const res = await fetch('/api/deploy-status', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load deploy status',
      });
    }
  }

  useEffect(() => {
    loadDeployStatus();

    const interval = window.setInterval(loadDeployStatus, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const deployment = status?.deployment;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-cyan-300">
            Deploy Intelligence
          </div>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Latest Deploy
          </h2>

          <p className="mt-2 text-sm text-white/60">
            Live status from the deploy-status API.
          </p>
        </div>

        <div
          className={[
            'rounded-xl border px-3 py-2 text-sm',
            status?.deployFailed
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
          ].join(' ')}
        >
          {status?.deployFailed ? 'Deploy failed' : 'Deploy healthy'}
        </div>
      </div>

      <div className="mt-5 space-y-2 text-sm text-white/70">
        {status?.error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
            {status.error}
          </div>
        )}

        {!status?.error && !deployment && <div>No deployment found.</div>}

        {deployment && (
          <>
            <div>Status: {deployment.state}</div>
            <div>Deployment ID: {deployment.id}</div>

            {deployment.url && (
              <a
                href={`https://${deployment.url}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-blue-300 underline underline-offset-4 hover:text-blue-200"
              >
                Open deployment
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}