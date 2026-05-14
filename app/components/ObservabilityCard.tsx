"use client";

import { useEffect, useState } from "react";

type Observation = {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
};

type ObservabilityData = {
  recommendation: "ok" | "requiresApproval" | "runtime-cooldown" | "recovery-caution" | "execution-stop-suggestion";
  observations: Observation[];
  repeatedRiskyFiles: Array<{ targetFile: string; hits: number }>;
  summary: {
    failedTasks: number;
    recoveryEvents: number;
    deployFailures: number;
    blockedRuntime: boolean;
    unhealthyRunner: boolean;
    stalledChains: number;
  };
};

const RECOMMENDATION_STYLE: Record<ObservabilityData["recommendation"], string> = {
  "ok": "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  "requiresApproval": "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  "runtime-cooldown": "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  "recovery-caution": "border-orange-500/30 bg-orange-500/10 text-orange-200",
  "execution-stop-suggestion": "border-red-500/30 bg-red-500/10 text-red-200",
};

const RECOMMENDATION_LABEL: Record<ObservabilityData["recommendation"], string> = {
  "ok": "✓ System healthy",
  "requiresApproval": "⚠ Requires approval",
  "runtime-cooldown": "⚠ Runtime cooldown suggested",
  "recovery-caution": "🔶 Recovery caution",
  "execution-stop-suggestion": "🔴 Stop execution suggested",
};

const SEVERITY_STYLE: Record<Observation["severity"], string> = {
  low: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  high: "border-red-500/30 bg-red-500/10 text-red-200",
};

export default function ObservabilityCard() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/observability", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) return null;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-white/40">
            Observability
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">Runtime Signals</h2>
        </div>
        <span className={`rounded-xl border px-3 py-1.5 text-sm ${RECOMMENDATION_STYLE[data.recommendation]}`}>
          {RECOMMENDATION_LABEL[data.recommendation]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Failed tasks", value: data.summary.failedTasks },
          { label: "Recovery events", value: data.summary.recoveryEvents },
          { label: "Deploy failures", value: data.summary.deployFailures },
          { label: "Stalled chains", value: data.summary.stalledChains },
          { label: "Runtime blocked", value: data.summary.blockedRuntime ? "yes" : "no" },
          { label: "Runner unhealthy", value: data.summary.unhealthyRunner ? "yes" : "no" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-neutral-950/50 p-3">
            <div className="text-xs uppercase tracking-wide text-white/30">{stat.label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {data.observations.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-white/30">Observations</div>
          {data.observations.map((obs) => (
            <div key={obs.code} className={`rounded-lg border px-3 py-2 text-xs ${SEVERITY_STYLE[obs.severity]}`}>
              <span className="font-semibold">{obs.code}</span>
              <span className="ml-2 opacity-80">{obs.detail}</span>
            </div>
          ))}
        </div>
      )}

      {data.repeatedRiskyFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-white/30">Risky files</div>
          {data.repeatedRiskyFiles.map((f) => (
            <div key={f.targetFile} className="flex items-center justify-between rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs">
              <span className="text-orange-200 font-mono">{f.targetFile}</span>
              <span className="text-orange-300/60">{f.hits} hits</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
