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

      {loading && <div style={{ color: "#999" }}>Loading activity...</div>}

      {!loading && activity.length === 0 && (
        <div style={{ color: "#999" }}>No activity yet.</div>
      )}

      {!loading &&
        activity.map((event) => (
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