"use client";

import { useState, useEffect, useCallback } from "react";

type NicheOpportunity = {
  niche: string;
  score: number;
  demand: "low" | "medium" | "high";
  competition: "low" | "medium" | "high";
  estimatedMonthlyRevenue: { min: number; max: number };
  suggestedProductType: string;
  reasoning: string;
  source: string;
};

const SIGNAL_COLOR: Record<string, string> = {
  high: "text-emerald-400",
  medium: "text-yellow-400",
  low: "text-red-400",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
};

export default function NicheDetectorPage() {
  const [opportunities, setOpportunities] = useState<NicheOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const scan = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect-opportunities" }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.opportunities)) {
        setOpportunities(data.opportunities);
        setLastScanned(new Date().toLocaleTimeString());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  async function createPipeline(opportunity: NicheOpportunity) {
    try {
      setCreating(opportunity.niche);
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: `${opportunity.niche} Digital Product`,
          niche: opportunity.niche,
          productType: opportunity.suggestedProductType,
          targetMarket: opportunity.niche,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = "/pipeline";
      }
    } finally {
      setCreating(null);
    }
  }

  const sorted = [...opportunities].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Niche Detector</h1>
          <p className="mt-2 text-sm text-white/60">
            AI scans the market and finds the best digital product opportunities.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastScanned && (
            <span className="text-xs text-white/30">Last scan: {lastScanned}</span>
          )}
          <button
            type="button"
            onClick={scan}
            disabled={loading}
            className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50"
          >
            {loading ? "Scanning..." : "🔍 Scan Market"}
          </button>
        </div>
      </div>

      {loading && opportunities.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <div className="text-lg font-medium text-white/60">Scanning market for opportunities...</div>
          <div className="mt-2 text-sm text-white/30">Analyzing Etsy, Gumroad, and trending niches</div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((opp) => (
            <div key={opp.niche} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-white leading-snug">{opp.niche}</div>
                <div className={`text-2xl font-bold tabular-nums ${SCORE_COLOR(opp.score)}`}>
                  {opp.score}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-neutral-950/50 p-2">
                  <div className="text-white/30">Demand</div>
                  <div className={`font-medium mt-0.5 ${SIGNAL_COLOR[opp.demand]}`}>{opp.demand}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-neutral-950/50 p-2">
                  <div className="text-white/30">Competition</div>
                  <div className={`font-medium mt-0.5 ${SIGNAL_COLOR[opp.competition]}`}>{opp.competition}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-neutral-950/50 p-2">
                  <div className="text-white/30">Est. Revenue</div>
                  <div className="font-medium mt-0.5 text-white">
                    ${opp.estimatedMonthlyRevenue.min}–${opp.estimatedMonthlyRevenue.max}/mo
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-neutral-950/50 p-2">
                  <div className="text-white/30">Platform</div>
                  <div className="font-medium mt-0.5 text-white">{opp.source}</div>
                </div>
              </div>

              <div className="text-xs text-white/50 leading-relaxed">{opp.reasoning}</div>

              <div className="mt-auto">
                <div className="mb-2 text-xs text-white/30">
                  Suggested: <span className="text-white/60">{opp.suggestedProductType}</span>
                </div>
                <button
                  type="button"
                  onClick={() => createPipeline(opp)}
                  disabled={creating === opp.niche}
                  className="w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50"
                >
                  {creating === opp.niche ? "Creating..." : "→ Start Pipeline"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
