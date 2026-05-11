"use client";

import { useState } from "react";

export default function ApprovePreviewTaskButton({
  taskId,
}: {
  taskId: string;
}) {
  const [isPending, setIsPending] = useState(false);

  async function approveTask() {
    setIsPending(true);

    try {
      await fetch("/api/approve-preview-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });

      window.location.reload();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={approveTask}
      disabled={isPending}
      className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Approving..." : "Approve preview task"}
    </button>
  );
}
