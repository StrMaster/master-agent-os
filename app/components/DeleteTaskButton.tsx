'use client';

import { useState } from 'react';

const DELETABLE_STATUSES = [
  'todo',
  'queued',
  'planner-required',
  'planner-split',
  'failed',
];

export default function DeleteTaskButton({
  taskId,
  status,
}: {
  taskId: string;
  status?: string;
}) {
  const [loading, setLoading] = useState(false);
  const canDelete = DELETABLE_STATUSES.includes(status ?? '');

  if (!canDelete) {
    return null;
  }

  async function deleteTask() {
    if (!confirm('Delete this task?')) {
      return;
    }

    try {
      setLoading(true);

      const res = await fetch('/api/delete-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete task');
      }

      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={deleteTask}
      className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? 'Deleting...' : 'Delete task'}
    </button>
  );
}