"use client";

import { useState } from "react";

type ProjectResult = {
  repo: {
    name: string;
    url: string;
    owner: string;
  };
  vercel?: {
    projectUrl: string;
    deploymentId?: string;
    deploymentState?: string;
  } | null;
};

const PROJECT_TYPES = [
  { value: "ai-consultant", label: "AI Consultant" },
  { value: "chatbot", label: "Chatbot" },
  { value: "landing-page", label: "Landing Page" },
  { value: "saas-tool", label: "SaaS Tool" },
];

const INDUSTRIES = [
  { value: "dental", label: "Dental Clinic" },
  { value: "restaurant", label: "Restaurant" },
  { value: "real-estate", label: "Real Estate" },
  { value: "fitness", label: "Fitness" },
  { value: "beauty", label: "Beauty & Wellness" },
  { value: "legal", label: "Legal" },
  { value: "general", label: "General" },
];

export default function ProjectsPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("ai-consultant");
  const [industry, setIndustry] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProjectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !description.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setStep("Creating GitHub repo...");

      const res = await fetch("/api/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, type, industry }),
      });

      setStep("Generating AI code...");
      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Failed to create project");
        return;
      }

      setStep("Deploying to Vercel...");
      setResult(data);
      setStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setStep(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Product Builder</h1>
        <p className="mt-2 text-sm text-white/60">
          Describe a product → AI builds and deploys it automatically.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-xl font-semibold">New Project</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. dental-ai-consultant"
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">Project Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe what this product should do..."
            className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
          />
        </div>

        <button
          type="button"
          onClick={create}
          disabled={loading || !name.trim() || !description.trim()}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? step ?? "Building..." : "🚀 Build Product"}
        </button>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-emerald-300">✅ Project Created</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">GitHub Repo</div>
              <div className="text-sm font-semibold text-white">{result.repo.name}</div>
              <a
                href={result.repo.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
              >
                View on GitHub →
              </a>
            </div>

            {result.vercel && (
              <div className="rounded-xl border border-white/10 bg-neutral-950/50 p-4">
                <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Vercel Deploy</div>
                <div className="text-sm font-semibold text-white">{result.vercel.deploymentState ?? "Deploying..."}</div>
                <a
                  href={result.vercel.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
                >
                  View on Vercel →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
