"use client";

import { useState } from "react";

const HIDDEN_TASKS_KEY = "master-agent-hidden-task-ids";

function readHiddenTaskIds() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HIDDEN_TASKS_KEY) ?? "[]"
    );

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function RemoveTaskButton({
  taskId,
}: {
  taskId: string;
}) {
  const [isPending, setIsPending] = useState(false);

  function removeTask() {
    const confirmed = window.confirm(
      "Hide this task from this browser? This will not trigger a deploy."
    );

    if (!confirmed) {
      return;
    }

    setIsPending(true);

    try {
      const hiddenTaskIds = new Set(readHiddenTaskIds());
      hiddenTaskIds.add(taskId);

      window.localStorage.setItem(
        HIDDEN_TASKS_KEY,
        JSON.stringify([...hiddenTaskIds])
      );

      document
        .querySelector(`[data-task-id="${taskId}"]`)
        ?.remove();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={removeTask}
      disabled={isPending}
      className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Removing..." : "Remove task"}
    </button>
  );
}
