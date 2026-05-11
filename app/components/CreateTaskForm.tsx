"use client";

import { useState } from "react";

const TARGET_FILES = [
  "app/execution/page.tsx",
  "app/components/RunAgentButton.tsx",
  "app/components/ActivityFeed.tsx",
];

export default function CreateTaskForm() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [targetFile, setTargetFile] = useState(TARGET_FILES[0]);
  const [priority, setPriority] = useState("medium");
  const [autoRun, setAutoRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/create-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          title,
          targetFile,
          priority,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(data.error || "Failed to create task");
        return;
      }

      setResult(
  [
    data.message,
    data.followUp,
  ]
    .filter(Boolean)
    .join(" ")
);
      if (autoRun) {
  await fetch("/api/agent-runner", {
    method: "POST",
  });
}
      setTitle("");
      setPriority("medium");
    } catch (error) {
      setResult("Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
        background: "#0f0f0f",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        Create Manual Task
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      > 
<textarea
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  placeholder="Describe what the agent should do..."
  rows={4}
  style={{
    padding: 12,
    borderRadius: 8,
    border: "1px solid #333",
    background: "#111",
    color: "white",
    resize: "vertical",
  }}
/>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #333",
            background: "#111",
            color: "white",
          }}
        />

        <select
          value={targetFile}
          onChange={(e) => setTargetFile(e.target.value)}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #333",
            background: "#111",
            color: "white",
          }}
        >
          {TARGET_FILES.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #333",
            background: "#111",
            color: "white",
          }}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>

        <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#aaa",
  }}
>
  <input
    type="checkbox"
    checked={autoRun}
    onChange={(e) => setAutoRun(e.target.checked)}
  />

  Auto run agent after task creation
</label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Creating..." : "Create Task"}
        </button>

        {result && (
          <div
            style={{
              fontSize: 14,
              color: "#aaa",
            }}
          >
            {result}
          </div>
        )}
      </form>
    </div>
  );
}
