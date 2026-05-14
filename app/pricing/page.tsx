"use client";

import { useState } from "react";

type PricingResult = {
  product: string;
  costs: {
    anthropicApiUsd: number;
    vercelUsd: number;
    supabaseUsd: number;
    tavilyUsd: number;
    otherUsd: number;
  };
  totalCostUsd: number;
  suggestedPrices: {
    minimum: number;
    recommended: number;
    premium: number;
  };
  margins: {
    minimum: number;
    recommended: number;
    premium: number;
  };
  monthlyBreakeven: {
    atMinimum: number;
    atRecommended: number;
    atPremium: number;
  };
  reasoning: string;
  warnings: string[];
};

export default function PricingPage() {
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("saas-tool");
  const [targetMarket, setTargetMarket] = useState("");
  const [competitorPrices, setCompetitorPrices] = useState("");
  const [monthlyTasks, setMonthlyTasks] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    if (!productName.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const prices = competitorPrices
        .split(",")
        .map((p) => parseFloat(p.trim()))
        .filter((p) => !isNaN(p));

      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate",
          productName: productName.trim(),
          productType,
          targetMarket: targetMarket.trim() || "small business",
          competitorPrices: prices.length ? prices : undefined,
          estimatedMonthlyTasks: parseInt(monthlyTasks) || 100,
        }),
      });

      const data = await res.json();
      if (data.ok) setResult(data.result);
      else setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Pricing Engine</h1>
        <p className="mt-2 text-sm text-white/60">
          Calculate optimal pricing based on infrastructure costs, market data, and margins.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Calculate Pricing</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">Product Name</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. AI Receptionist Chatbot"
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">Product Type</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              <option value="saas-tool">SaaS Tool</option>
              <option value="digital-template">Digital Template</option>
              <option value="chatbot">Chatbot</option>
              <option value="automation">Automation</option>
              <option value="api-service">API Service</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Target Market</label>
            <input
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="e.g. restaurants, law firms..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">Est. Monthly AI Tasks</label>
            <input
              value={monthlyTasks}
              onChange={(e) => setMonthlyTasks(e.target.value)}
              type="number"
              placeholder="100"
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-white/60">Competitor Prices (comma separated, optional)</label>
            <input
              value={competitorPrices}
              onChange={(e) => setCompetitorPrices(e.target.value)}
              placeholder="e.g. 29, 49, 99"
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={calculate}
          disabled={loading || !productName.trim()}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Calculating..." : "Calculate Pricing"}
        </button>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold mb-4">Infrastructure Costs</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(result.costs).map(([key, val]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-neutral-950/50 p-3">
                  <div className="text-xs text-white/40">{key.replace("Usd", "")}</div>
                  <div className="mt-1 text-sm font-semibold text-white">${Number(val).toFixed(4)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-neutral-950/50 p-3">
              <div className="text-xs text-white/40">Total monthly cost</div>
              <div className="mt-1 text-lg font-semibold text-emerald-300">${result.totalCostUsd.toFixed(4)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold mb-4">Suggested Pricing</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Minimum", price: result.suggestedPrices.minimum, margin: result.margins.minimum, breakeven: result.monthlyBreakeven.atMinimum, color: "border-zinc-500/30 bg-zinc-500/10" },
                { label: "Recommended", price: result.suggestedPrices.recommended, margin: result.margins.recommended, breakeven: result.monthlyBreakeven.atRecommended, color: "border-violet-500/30 bg-violet-500/10" },
                { label: "Premium", price: result.suggestedPrices.premium, margin: result.margins.premium, breakeven: result.monthlyBreakeven.atPremium, color: "border-emerald-500/30 bg-emerald-500/10" },
              ].map((tier) => (
                <div key={tier.label} className={`rounded-xl border p-4 ${tier.color}`}>
                  <div className="text-xs uppercase tracking-wide text-white/40">{tier.label}</div>
                  <div className="mt-2 text-2xl font-bold text-white">${tier.price}/mo</div>
                  <div className="mt-1 text-xs text-white/50">{tier.margin}% margin</div>
                  <div className="mt-1 text-xs text-white/50">{tier.breakeven} clients to breakeven</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
            <div className="text-xs uppercase tracking-wide text-blue-300/60 mb-2">Pricing Strategy</div>
            <p className="text-sm text-blue-100/80">{result.reasoning}</p>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 space-y-2">
              <div className="text-xs uppercase tracking-wide text-yellow-300/60">Warnings</div>
              {result.warnings.map((w, i) => (
                <div key={i} className="text-sm text-yellow-100/80">⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
