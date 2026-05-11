"use client";

import { useState } from "react";

export default function ApprovePlannerWaveButton({
  taskId,
}: {
  taskId: string;
}) {
  const [isPending, setIsPending] = useState(false);

  async function approveWave() {
    setIsPending(true);

    try {
      await fetch("/api/approve-planner-wave", {
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
      onClick={approveWave}
      disabled={isPending}
      className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Approving wave..." : "Approve wave"}
    </button>
  );
}
