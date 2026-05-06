"use client";

import { useEffect, useState } from "react";

type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  taskId?: string;
  summary?: string;
  changedLines?: number;
  safe?: boolean;
  branch?: string;
  merged?: boolean;
  pullRequestUrl?: string;
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

<div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
  {["all", "generated-task", "proposal", "retry", "apply", "failed"].map((item) => (
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
        filteredActivity.map((event) => (
          <div
            key={event.id}
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              border: `1px solid ${getEventColors(event.type).border}`,
background: getEventColors(event.type).background,
              lineHeight: 1.5,
            }}
          >
            <strong>{event.type}</strong>

            <div style={{ color: "#999", fontSize: 13 }}>
              {new Date(event.timestamp).toLocaleString()}
            </div>

            {event.taskId && <div>Task: {event.taskId}</div>}
            {event.summary && <div>Summary: {event.summary}</div>}
            {typeof event.changedLines === "number" && (
              <div>Changed lines: {event.changedLines}</div>
            )}
            {typeof event.safe === "boolean" && (
              <div>Safe: {event.safe ? "✅ yes" : "❌ no"}</div>
            )}
            {event.branch && <div>Branch: {event.branch}</div>}
            {typeof event.merged === "boolean" && (
              <div>Merged: {event.merged ? "✅ yes" : "❌ no"}</div>
            )}
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
        ))}
    </div>
  );
}