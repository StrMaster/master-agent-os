"use client";

import { useState } from "react";

export default function RunNowButton({ taskId }: { taskId: string }) {
  const [isPending, setIsPending] = useState(false);

  async function runNow() {
    setIsPending(true);

    try {
      const res = await fetch("/api/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRunOnce: true, taskId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        window.alert(`Run failed (${res.status}): ${text.slice(0, 200)}`);
        return;
      }

      window.location.reload();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runNow}
      disabled={isPending}
      className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Running..." : "Run now"}
    </button>
  );
}
