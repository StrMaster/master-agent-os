"use client";

import { useState } from "react";

export default function RunAgentButton() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
        mode: "client-error",
        error: error instanceof Error ? error.message : "Unknown client error",
      });
    } finally {
      setLoading(false);
    }
  }

  const change = result?.proposal?.changes?.[0];

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={runAgent}
        disabled={loading}
        style={{
          padding: "12px 18px",
          borderRadius: 12,
          border: "1px solid #333",
          background: loading ? "#333" : "#111",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        {loading ? "Agent running..." : "Run Agent"}
      </button>
      async function runLoop() {
  setLoading(true);
  setResult(null);

  const results = [];

  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch("/api/agent-runner", {
        method: "POST",
      });

      const data = await res.json();
      results.push(data);

      if (data.mode === "idle" || !data.ok) {
        break;
      }
    }

    setResult({
      ok: true,
      mode: "loop",
      runs: results,
    });
  } catch (error) {
    setResult({
      ok: false,
      mode: "loop-client-error",
      error: error instanceof Error ? error.message : "Unknown client error",
    });
  } finally {
    setLoading(false);
  }
}
      <button
  onClick={runLoop}
  disabled={loading}
  style={{
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid #333",
    background: loading ? "#333" : "#1f2937",
    color: "white",
    cursor: loading ? "not-allowed" : "pointer",
    fontWeight: 700,
    marginLeft: 10,
  }}
>
  {loading ? "Loop running..." : "Run Agent Loop"}
</button>
      {loading && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #333",
            background: "#151515",
            color: "#aaa",
          }}
        >
          Generating proposal → checking safety → applying changes...
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
          <div
            style={{
              padding: 18,
              borderRadius: 16,
              border: result.ok ? "1px solid #0f6" : "1px solid #f55",
              background: result.ok ? "#06210f" : "#260b0b",
              color: result.ok ? "#8dffb0" : "#ff9a9a",
              lineHeight: 1.6,
            }}
          >
            <strong>
              {result.ok ? "Agent run completed ✅" : "Agent run failed ❌"}
            </strong>

            <div>Mode: {result.mode ?? "unknown"}</div>
            {result.taskId && <div>Task: {result.taskId}</div>}
            {result.reason && <div>Reason: {result.reason}</div>}
            {result.error && <div>Error: {result.error}</div>}
          </div>

          {result.proposal && (
            <div
              style={{
                padding: 18,
                borderRadius: 16,
                border: "1px solid #0a6",
                background: "#06210f",
                color: "#b6ffd0",
                lineHeight: 1.6,
              }}
            >
              <strong>Proposal</strong>
              <div>Summary: {result.proposal.summary}</div>
              <div>Branch: {result.proposal.branchName}</div>
              <div>Changed lines: {result.proposal.changedLines}</div>
              <div>Safe: {String(result.proposal.isSafe)}</div>
            </div>
          )}

          {result.applyResult && (
            <div
              style={{
                padding: 18,
                borderRadius: 16,
                border: result.applyResult.ok
                  ? "1px solid #0f6"
                  : "1px solid #f55",
                background: result.applyResult.ok ? "#06210f" : "#260b0b",
                color: result.applyResult.ok ? "#8dffb0" : "#ff9a9a",
                lineHeight: 1.6,
                wordBreak: "break-word",
              }}
            >
              <strong>
                PR created {result.applyResult.ok ? "✅" : "❌"}
              </strong>

              <div>Branch: {result.applyResult.branchName}</div>
              <div>
                Merged: {result.applyResult.merged ? "✅ yes" : "❌ no"}
              </div>

              {result.applyResult.mergeError && (
                <div>Merge error: {result.applyResult.mergeError}</div>
              )}

              {result.applyResult.error && (
  <div>Error: {result.applyResult.error}</div>
)}

{result.applyResult.details && (
  <div>Details: {JSON.stringify(result.applyResult.details)}</div>
)}

              {result.applyResult.pullRequestUrl && (
                <div>
                  Review:{" "}
                  <a
                    href={result.applyResult.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    {result.applyResult.pullRequestUrl}
                  </a>
                </div>
              )}

              {result.applyResult.pullRequestUrl && (
                <div>
                  Review diff:{" "}
                  <a
                    href={`${result.applyResult.pullRequestUrl}/files`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    {result.applyResult.pullRequestUrl}/files
                  </a>
                </div>
              )}
            </div>
          )}

          {change && (
            <div
              style={{
                padding: 18,
                borderRadius: 16,
                border: "1px solid #333",
                background: "#111",
                color: "#ddd",
                lineHeight: 1.45,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              <strong>Diff preview</strong>

              <div style={{ marginTop: 10, color: "#999" }}>
                File: {change.filePath}
              </div>

              <div style={{ marginTop: 12, color: "#f88" }}>--- before</div>
              <div>{change.originalContent?.slice(0, 1200)}</div>

              <div style={{ marginTop: 12, color: "#8f8" }}>+++ after</div>
              <div>{change.content?.slice(0, 1200)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
