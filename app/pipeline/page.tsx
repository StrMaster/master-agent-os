"use client";

import { useState, useEffect, useCallback } from "react";

type PipelineStage =
  | "research"
  | "competitor"
  | "pricing"
  | "build"
  | "listing"
  | "outreach";

type PipelineStageStatus =
  | "pending"
  | "running"
  | "waiting-approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

type PipelineStageData = {
  stage: PipelineStage;
  status: PipelineStageStatus;
  result?: unknown;
  error?: string;
};

type Pipeline = {
  id: string;
  name: string;
  niche: string;
  productType: string;
  targetMarket: string;
  status: "active" | "completed" | "cancelled";
  stages: PipelineStageData[];
  createdAt: string;
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  research: "Market Research",
  competitor: "Competitor Analysis",
  pricing: "Pricing",
  build: "Build Product",
  listing: "Create Listing",
  outreach: "Find Clients",
};

const STATUS_STYLE: Record<PipelineStageStatus, string> = {
  pending: "border-white/10 bg-white/5 text-white/40",
  running: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  "waiting-approval": "border-violet-500/30 bg-violet-500/10 text-violet-200",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-red-500/30 bg-red-500/10 text-red-200",
};

const STAGES: PipelineStage[] = ["research", "competitor", "pricing", "build", "listing", "outreach"];

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [productType, setProductType] = useState("saas-tool");
  const [targetMarket, setTargetMarket] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningStage, setRunningStage] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const loadPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setPipelines(data.pipelines);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  async function create() {
    if (!name.trim() || !niche.trim()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, niche, productType, targetMarket }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadPipelines();
        setCreating(false);
        setName("");
        setNiche("");
        setTargetMarket("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function runStage(pipelineId: string, stage: PipelineStage) {
    try {
      setRunningStage(`${pipelineId}-${stage}`);
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-stage", pipelineId, stage }),
      });
      await res.json();
      await loadPipelines();
    } finally {
      setRunningStage(null);
    }
  }

  async function approveStage(pipelineId: string, stage: PipelineStage) {
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", pipelineId, stage }),
    });
    await loadPipelines();
  }

  async function rejectStage(pipelineId: string, stage: PipelineStage) {
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", pipelineId, stage }),
    });
    await loadPipelines();
  }

  async function deletePipeline(pipelineId: string) {
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", pipelineId }),
    });
    await loadPipelines();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Pipeline</h1>
          <p className="mt-2 text-sm text-white/60">
            From idea to sale — approve each stage before proceeding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition"
        >
          + New Pipeline
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold">New Pipeline</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-white/60">Product Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Receptionist for Restaurants"
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </div>
            <div>
              <label className="text-sm text-white/60">Niche</label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. restaurant chatbot"
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
                <option value="chatbot">Chatbot</option>
                <option value="digital-template">Digital Template</option>
                <option value="automation">Automation</option>
                <option value="api-service">API Service</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60">Target Market</label>
              <input
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
                placeholder="e.g. small restaurants"
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={create}
              disabled={loading || !name.trim() || !niche.trim()}
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Pipeline"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 hover:bg-white/10 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pipelines.length === 0 && !creating && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
          No pipelines yet. Create your first product pipeline above.
        </div>
      )}

      {pipelines.map((pipeline) => (
        <div key={pipeline.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">{pipeline.name}</div>
              <div className="mt-1 text-xs text-white/40">
                {pipeline.niche} · {pipeline.productType} · {pipeline.targetMarket}
              </div>
            </div>
            <button
              type="button"
              onClick={() => deletePipeline(pipeline.id)}
              className="text-xs text-white/30 hover:text-red-400 transition"
            >
              Delete
            </button>
          </div>

          <div className="space-y-2">
            {STAGES.map((stage, idx) => {
              const stageData = pipeline.stages.find((s) => s.stage === stage);
              if (!stageData) return null;

              const prevStage = idx > 0 ? pipeline.stages.find((s) => s.stage === STAGES[idx - 1]) : null;
              const canRun = stageData.status === "pending" &&
                (idx === 0 || prevStage?.status === "approved");
              const isRunning = runningStage === `${pipeline.id}-${stage}`;
              const stageKey = `${pipeline.id}-${stage}`;

              return (
                <div key={stage} className={`rounded-xl border p-4 ${STATUS_STYLE[stageData.status]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/30">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
                      <span className="text-xs opacity-60">{stageData.status}</span>
                    </div>
                    <div className="flex gap-2">
                      {canRun && (
                        <button
                          type="button"
                          onClick={() => runStage(pipeline.id, stage)}
                          disabled={isRunning}
                          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition disabled:opacity-50"
                        >
                          {isRunning ? "Running..." : "Run"}
                        </button>
                      )}
                      {stageData.status === "waiting-approval" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedStage(expandedStage === stageKey ? null : stageKey)}
                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition"
                          >
                            {expandedStage === stageKey ? "Hide" : "View"}
                          </button>
                          <button
                            type="button"
                            onClick={() => approveStage(pipeline.id, stage)}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 transition"
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectStage(pipeline.id, stage)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200 hover:bg-red-500/20 transition"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {stageData.error && (
                    <div className="mt-2 text-xs text-red-300">{stageData.error}</div>
                  )}

                  {expandedStage === stageKey && stageData.result !== undefined && (
  <div className="mt-3 rounded-lg border border-white/10 bg-neutral-950/50 p-3 text-xs text-white/70 overflow-auto max-h-64">
    <pre>{JSON.stringify(stageData.result as Record<string, unknown>, null, 2)}</pre>
  </div>
)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
