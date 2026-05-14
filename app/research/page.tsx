"use client";

import { useState, useEffect } from "react";

type NicheAnalysis = {
  niche: string;
  demand: "low" | "medium" | "high";
  competition: "low" | "medium" | "high";
  suggestedProducts: string[];
  topKeywords: string[];
  estimatedPrice: { min: number; max: number };
  reasoning: string;
};

type CompetitorAnalysis = {
  niche: string;
  competitors: Array<{
    name: string;
    url: string;
    strengths: string[];
    weaknesses: string[];
    priceRange: string;
  }>;
  marketGap: string;
  opportunity: string;
};

const SIGNAL_COLOR: Record<string, string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  low: "border-red-500/30 bg-red-500/10 text-red-200",
};

export default function ResearchPage() {
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [nicheAnalysis, setNicheAnalysis] = useState<NicheAnalysis | null>(null);
  const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [trendingNiches, setTrendingNiches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrending() {
    try {
      setLoadingTrending(true);
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trending" }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.niches)) setTrendingNiches(data.niches);
    } catch {
      // silent
    } finally {
      setLoadingTrending(false);
    }
  }

  async function analyze() {
    if (!niche.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setNicheAnalysis(null);
      setCompetitorAnalysis(null);

      const [nicheRes, competitorRes] = await Promise.all([
        fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze-niche", niche }),
        }),
        fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze-competitors", niche }),
        }),
      ]);

      const nicheData = await nicheRes.json();
      const competitorData = await competitorRes.json();

      if (nicheData.ok) setNicheAnalysis(nicheData.analysis);
      if (competitorData.ok) setCompetitorAnalysis(competitorData.analysis);
      if (!nicheData.ok) setError(nicheData.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrending();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Research</h1>
        <p className="mt-2 text-sm text-white/60">
          Market research, niche analysis, and competitor intelligence.
        </p>
      </div>

      {trendingNiches.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trending Niches</h2>
            <button
              type="button"
              onClick={fetchTrending}
              disabled={loadingTrending}
              className="text-xs text-white/40 hover:text-white/60 transition"
            >
              {loadingTrending ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trendingNiches.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNiche(n)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h2 className="text-lg font-semibold">Analyze Niche</h2>
        <div className="flex gap-3">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="e.g. wedding planner templates, AI prompt packs..."
            className="flex-1 rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-white placeholder-white/30"
          />
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !niche.trim()}
            className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {nicheAnalysis && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Niche Analysis — {nicheAnalysis.niche}</h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Demand</div>
              <span className={`mt-2 inline-block rounded-lg border px-3 py-1 text-sm ${SIGNAL_COLOR[nicheAnalysis.demand]}`}>
                {nicheAnalysis.demand}
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Competition</div>
              <span className={`mt-2 inline-block rounded-lg border px-3 py-1 text-sm ${SIGNAL_COLOR[nicheAnalysis.competition]}`}>
                {nicheAnalysis.competition}
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">Price Range</div>
              <div className="mt-2 text-lg font-semibold text-white">
                ${nicheAnalysis.estimatedPrice.min} – ${nicheAnalysis.estimatedPrice.max}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Suggested Products</div>
              <ul className="space-y-1">
                {nicheAnalysis.suggestedProducts.map((p) => (
                  <li key={p} className="text-sm text-white/70">• {p}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Keywords</div>
              <div className="flex flex-wrap gap-1">
                {nicheAnalysis.topKeywords.map((k) => (
                  <span key={k} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60">{k}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100/80">
            {nicheAnalysis.reasoning}
          </div>
        </div>
      )}

      {competitorAnalysis && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Competitor Analysis</h2>

          <div className="space-y-3">
            {competitorAnalysis.competitors.slice(0, 4).map((c) => (
              <div key={c.name} className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <span className="text-xs text-white/40">{c.priceRange}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-emerald-400">Strengths: </span>
                    <span className="text-white/60">{c.strengths.join(", ")}</span>
                  </div>
                  <div>
                    <span className="text-red-400">Weaknesses: </span>
                    <span className="text-white/60">{c.weaknesses.join(", ")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <div className="text-xs uppercase tracking-wide text-yellow-300/60 mb-1">Market Gap</div>
              <div className="text-sm text-yellow-100/80">{competitorAnalysis.marketGap}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-300/60 mb-1">Opportunity</div>
              <div className="text-sm text-emerald-100/80">{competitorAnalysis.opportunity}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
