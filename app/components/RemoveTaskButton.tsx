"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const HIDDEN_TASKS_KEY = "master-agent-hidden-task-ids";

function hideTaskLocally(taskId: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_TASKS_KEY) ?? "[]");
    const hiddenIds = Array.isArray(parsed) ? parsed.map(String) : [];
    const next = Array.from(new Set([...hiddenIds, taskId]));
    window.localStorage.setItem(HIDDEN_TASKS_KEY, JSON.stringify(next));
  } catch {
    window.localStorage.setItem(HIDDEN_TASKS_KEY, JSON.stringify([taskId]));
  }
}

export default function RemoveTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function removeTask() {
    const confirmed = window.confirm("Remove this task from the task board?");
    if (!confirmed) return;

    setIsPending(true);
    setError("");

    try {
      const res = await fetch("/api/delete-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json().catch(() => ({}));

      // Persist local hide even if the server-side delete only partially succeeds.
      // This prevents stale GitHub/Redis copies from reappearing after refresh.
      if (res.ok || data?.error === "Task not found") {
        hideTaskLocally(taskId);
        document.querySelector(`[data-task-id="${taskId}"]`)?.remove();
        setDone(true);
        router.refresh();
        return;
      }

      throw new Error(data?.error || "Failed to remove task");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove task";
      console.error("Failed to remove task", e);
      setError(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={removeTask}
        disabled={isPending || done}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {done ? "Removed!" : isPending ? "Removing..." : "Remove task"}
      </button>
      {error && <div className="text-xs text-red-200/80">{error}</div>}
    </div>
  );
}
