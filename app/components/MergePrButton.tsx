"use client";

import { useState } from "react";

export default function MergePrButton({
  taskId,
  pullRequestUrl,
}: {
  taskId: string;
  pullRequestUrl: string;
}) {
  const [isPending, setIsPending] = useState(false);

  async function mergePr() {
    const confirmed = window.confirm(
      "Merge this pull request into main? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch("/api/merge-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          pullRequestUrl,
          confirmMerge: true,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        window.alert(`Merge failed (${res.status}): ${text.slice(0, 200)}`);
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
      onClick={mergePr}
      disabled={isPending}
      className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Merging..." : "Merge PR"}
    </button>
  );
}
