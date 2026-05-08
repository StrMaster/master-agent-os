"use client";

import { useState } from "react";

type AgentResult = {
  ok?: boolean;
  mode?: string;
  message?: string;
  error?: string;
  runId?: string;
  taskId?: string;
  branchName?: string;
  pullRequestUrl?: string;
  validation?: {
    mergeable?: boolean | null;
    state?: string;
    merged?: boolean;
    draft?: boolean;
  } | null;
};

export default function RunAgentButton() {
  const [loading, setLoading] = useState(false);
  const [loopLoading, setLoopLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/agent-runner", {
        method: "POST",
      });

      const data = await res.json();

      setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAgentLoop() {
    setLoopLoading(true);
    setResult(null);

    try {
      let lastResult: AgentResult | null = null;

      for (let i = 0; i < 5; i++) {
        const res = await fetch("/api/agent-runner", {
          method: "POST",
        });

        const data = await res.json();
        lastResult = data;

        if (!data.ok || data.mode === "idle" || data.mode === "paused") {
          break;
        }
      }

      setResult(lastResult);
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    } finally {
      setLoopLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={runAgent}
          disabled={loading || loopLoading}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid #333",
            background: "#111",
            color: "white",
            fontWeight: 700,
            cursor: loading || loopLoading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Running..." : "Run Agent"}
        </button>

        <button
          onClick={runAgentLoop}
          disabled={loading || loopLoading}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "white",
            fontWeight: 700,
            cursor: loading || loopLoading ? "not-allowed" : "pointer",
          }}
        >
          {loopLoading ? "Running loop..." : "Run Agent Loop"}
        </button>
      </div>

      {(loading || loopLoading) && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          Running agent → generating patch → validating → creating PR...
        </div>
      )}

      {result && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            border: result.ok ? "1px solid #166534" : "1px solid #991b1b",
            background: result.ok ? "#052e16" : "#450a0a",
            color: result.ok ? "#bbf7d0" : "#fecaca",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {result.ok ? "Agent run completed" : "Agent run failed"}
          </div>

          {result.mode && <div>Mode: {result.mode}</div>}
          {result.message && <div>Message: {result.message}</div>}
          {result.error && <div>Error: {result.error}</div>}
          {result.taskId && <div>Task: {result.taskId}</div>}
          {result.branchName && <div>Branch: {result.branchName}</div>}

          {result.pullRequestUrl && (
            <div>
              PR:{" "}
              <a
                href={result.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#93c5fd",
                  textDecoration: "underline",
                }}
              >
                Open pull request
              </a>
            </div>
          )}

          {result.validation && (
            <div style={{ marginTop: 8 }}>
              <div>Validation:</div>
              <div>State: {result.validation.state ?? "unknown"}</div>
              <div>
                Mergeable:{" "}
                {result.validation.mergeable === null ||
                result.validation.mergeable === undefined
                  ? "unknown"
                  : result.validation.mergeable
                    ? "yes"
                    : "no"}
              </div>
              <div>Draft: {result.validation.draft ? "yes" : "no"}</div>
              <div>Merged: {result.validation.merged ? "yes" : "no"}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}