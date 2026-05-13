"use client";
import { useState } from "react";

export default function RemoveTaskButton({ taskId }: { taskId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  async function removeTask() {
    const confirmed = window.confirm(
      "Remove this task permanently?"
    );
    if (!confirmed) return;

    setIsPending(true);
    try {
      await fetch("/api/delete-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      document.querySelector(`[data-task-id="${taskId}"]`)?.remove();
      setDone(true);
    } catch (e) {
      console.error("Failed to remove task", e);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={removeTask}
      disabled={isPending || done}
      className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {done ? "Removed!" : isPending ? "Removing..." : "Remove task"}
    </button>
  );
}
