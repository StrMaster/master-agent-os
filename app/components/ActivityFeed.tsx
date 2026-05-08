"use client";

import { useEffect, useState } from "react";

type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  runId?: string;
  taskId?: string;
  summary?: string;
  changedLines?: number;
  safe?: boolean;
  branch?: string;
  merged?: boolean;
  pullRequestUrl?: string;
  provider?: string;
  status?: string;
  message?: string;
  targetFile?: string;
  priority?: string;
};

export default function ActivityFeed() {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
const [filter, setFilter] = useState("all");

  async function loadActivity() {
    const res = await fetch("/api/activity", { cache: "no-store" });
    const data = await res.json();

    if (data.ok) {
      setActivity(data.activity ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
  loadActivity();

  const interval = setInterval(() => {
    loadActivity();
  }, 5000);

  return () => clearInterval(interval);
}, []);

function getEventColors(type: string) {
  switch (type) {
    case "proposal":
      return {
        border: "#2563eb",
        background: "#0b1220",
      };

    case "apply":
      return {
        border: "#16a34a",
        background: "#07150d",
      };

case "deploy-triggered":
  return {
    border: "#06b6d4",
    background: "#071b22",
  };

    case "failed":
      return {
        border: "#dc2626",
        background: "#1a0b0b",
      };

case "retry":
  return {
    border: "#a855f7",
    background: "#160b22",
  };

    case "blocked":
      return {
        border: "#ca8a04",
        background: "#1a1607",
      };

case "auto-paused":
  return {
    border: "#f97316",
    background: "#1f1207",
  };

case "dependency-blocked":
  return {
    border: "#ca8a04",
    background: "#1a1607",
  };

case "circular-dependency":
  return {
    border: "#dc2626",
    background: "#220909",
  };

case "cooldown":
  return {
    border: "#38bdf8",
    background: "#071923",
  };

case "deploy-pending":
  return {
    border: "#06b6d4",
    background: "#071b22",
  };

case "manual-task-created":
  return {
    border: "#8b5cf6",
    background: "#160b22",
  };

    default:
      return {
        border: "#333",
        background: "#111",
      };
  }
}

const proposalCount = activity.filter((event) => event.type === "proposal").length;
const applyCount = activity.filter((event) => event.type === "apply").length;
const mergedCount = activity.filter(
  (event) => event.type === "apply" && event.merged === true
).length;
const failedCount = activity.filter((event) => event.type === "failed").length;
const recentEvents = activity.slice(0, 10);

const recentFailed = recentEvents.filter(
  (event) => event.type === "failed"
).length;

let healthStatus = "Healthy";
let healthColor = "#16a34a";

if (recentFailed >= 3) {
  healthStatus = "Failing";
  healthColor = "#dc2626";
} else if (recentFailed >= 1) {
  healthStatus = "Warning";
  healthColor = "#ca8a04";
}

const filteredActivity =
  filter === "all"
    ? activity
    : activity.filter((event) => event.type === filter);
const limitedActivity = filteredActivity.slice(0, 8);

const latestEvent = activity[0];

let agentState = "Idle";
let agentStateColor = "#6b7280";

if (latestEvent?.type === "failed") {
  agentState = "Failing";
  agentStateColor = "#dc2626";
} else if (recentFailed > 0) {
  agentState = "Warning";
  agentStateColor = "#ca8a04";
} else if (latestEvent) {
  agentState = "Active";
  agentStateColor = "#16a34a";
}

const groupedRuns = limitedActivity.reduce(
  (acc: Record<string, ActivityEvent[]>, event) => {
    const key = event.runId || "no-run";

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(event);

    return acc;
  },
  {}
);

const groupedEntries = Object.entries(groupedRuns);

  return (

    <div
      style={{
        marginTop: 24,
        padding: 18,
        borderRadius: 16,
        border: "1px solid #333",
        background: "#151515",
        color: "white",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Agent Activity</h2>
      <div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${agentStateColor}`,
    color: agentStateColor,
    background: "#0f0f0f",
    fontWeight: 700,
  }}
>
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: 999,
      background: agentStateColor,
      display: "inline-block",
    }}
  />
  Agent State: {agentState}
</div>
      <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 16,
  }}
>
  <div style={{ padding: 12, borderRadius: 10, background: "#0f0f0f" }}>
    <strong>{activity.length}</strong>
    <div style={{ color: "#999", fontSize: 13 }}>Total events</div>
  </div>

<div
  style={{
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    border: `1px solid ${healthColor}`,
    background: "#0f0f0f",
  }}
>
  <div
    style={{
      fontSize: 13,
      color: "#999",
      marginBottom: 6,
    }}
  >
    Agent Health
  </div>

<div style={{
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 6,
  marginBottom: 16,
}}>
  {[
  "all",
  "generated-task",
  "proposal",
  "retry",
  "apply",
  "deploy-triggered",
  "blocked",
  "failed",
  "auto-paused",
  "manual-task-created"
].map((item) => (
    <button
      key={item}
      onClick={() => setFilter(item)}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: filter === item ? "1px solid #0f6" : "1px solid #333",
        background: filter === item ? "#06210f" : "#111",
        color: filter === item ? "#8dffb0" : "#aaa",
        cursor: "pointer",
      }}
    >
      {item}
    </button>
  ))}
</div>

  <div
    style={{
      fontWeight: 700,
      color: healthColor,
      fontSize: 18,
    }}
  >
    {healthStatus}
  </div>

  <div
    style={{
      marginTop: 6,
      color: "#777",
      fontSize: 13,
    }}
  >
    Recent failed events: {recentFailed}
  </div>
</div>

  <div style={{ padding: 12, borderRadius: 10, background: "#0f0f0f" }}>
    <strong>{proposalCount}</strong>
    <div style={{ color: "#999", fontSize: 13 }}>Proposals</div>
  </div>

  <div style={{ padding: 12, borderRadius: 10, background: "#0f0f0f" }}>
    <strong>{applyCount}</strong>
    <div style={{ color: "#999", fontSize: 13 }}>Apply events</div>
  </div>

  <div style={{ padding: 12, borderRadius: 10, background: "#0f0f0f" }}>
    <strong>{mergedCount}</strong>
    <div style={{ color: "#999", fontSize: 13 }}>Merged</div>
  </div>

  <div style={{ padding: 12, borderRadius: 10, background: "#0f0f0f" }}>
    <strong>{failedCount}</strong>
    <div style={{ color: "#999", fontSize: 13 }}>Failed</div>
  </div>
</div>

      {loading && <div style={{ color: "#999" }}>Loading activity...</div>}

      {!loading && filteredActivity.length === 0 && (
        <div style={{ color: "#999" }}>No activity yet.</div>
      )}

      {!loading &&
        groupedEntries.map(([runId, events]) =>
  events.map((event) => (
          <div
            key={event.id}
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${getEventColors(event.type).border}`,
background: getEventColors(event.type).background,
              lineHeight: 1.35,
            }}
          >
            {event.runId && (
  <div
    style={{
      marginBottom: 8,
      color: "#8dffb0",
      fontWeight: 700,
      fontSize: 13,
    }}
  >
    RUN {event.runId.slice(0, 8)}
  </div>
)}

<div
  style={{
    fontWeight: 700,
    fontSize: 14,
    textTransform: "uppercase",
    marginBottom: 4,
  }}
>
  {event.type}
</div>
{event.message && <div>Message: {event.message}</div>}
              <div style={{ color: "#999", fontSize: 13 }}>
  {new Date(event.timestamp).toLocaleString()}
</div>
{event.targetFile && <div>Target: {event.targetFile}</div>}
{event.priority && <div>Priority: {event.priority}</div>}

            {event.runId && (
  <div style={{ color: "#999", fontSize: 13 }}>
    Run: {event.runId.slice(0, 8)}
  </div>
)}

            {event.taskId && <div>Task: {event.taskId}</div>}
            {event.summary && <div>Summary: {event.summary}</div>}
            {typeof event.changedLines === "number" && (
              <div>Lines: {event.changedLines}</div>
            )}
            {event.branch && <div>Branch: {event.branch.slice(0, 28)}...</div>}
            {typeof event.merged === "boolean" && (
              <div>Merged: {event.merged ? "✅ yes" : "❌ no"}</div>
            )}
            {event.provider && <div>Provider: {event.provider}</div>}
{event.status && <div>Status: {event.status}</div>}
            {event.pullRequestUrl && (
              <a
                href={event.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#8dffb0" }}
              >
                Open PR
              </a>
            )}
          </div>
        )))}
    </div>
  );
}