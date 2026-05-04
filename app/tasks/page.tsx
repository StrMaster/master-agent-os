'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useMasterStore } from '@/lib/master-store';

export default function TasksPage() {
  const { tasks, agents, createTask, executeTask, completeTask } =
  useMasterStore();

  function getAgentName(agentId?: string) {
    if (!agentId) return 'Unassigned';

    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? 'Unknown agent';
  }

  function getChangesPrompt(task: { title: string }) {
  return `File: app/execution/page.tsx

Rules:
- EXACT match
- One change only
- Do not refactor
- Keep change under 10 lines`;
}

  useEffect(() => {
  const interval = setInterval(() => {
    const nextTask = tasks.find((t) => t.status === 'todo');

    if (nextTask) {
      window.location.href = `/changes?prompt=${encodeURIComponent(
        getChangesPrompt(nextTask)
      )}`;
    }
  }, 15000);

  return () => clearInterval(interval);
}, [tasks]);
Find:
"No completed tasks"

Replace:
"No completed tasks (${task.title})"

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Tasks</h1>
          <p className="mt-2 text-sm text-white/60">
            Master Agent task queue. Send tasks into the Changes autopilot flow.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50">Phase 3</div>
          <div className="mt-1 text-lg font-medium">
            Master Agent Task Runner
          </div>
          <p className="mt-2 text-sm text-white/60">
            Tasks can now be routed into Changes for proposal, quality review,
            apply, PR creation, and auto-merge.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() =>
                createTask({
  title: 'Improve execution empty states',
  priority: 'medium',
})
              }
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Add sample UI task
            </button>

            <button
              onClick={() =>
                createTask({
  title: 'Improve task card spacing',
  priority: 'medium',
})
              }
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Add sample task card task
            </button>

            <button
  onClick={() => {
    const nextTask = tasks.find((t) => t.status === 'todo');

    if (nextTask) {
      window.location.href = `/changes?prompt=${encodeURIComponent(
        getChangesPrompt(nextTask)
      )}`;
    }
  }}
  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
>
  Run next task
</button>

            <button
              onClick={() =>
                createTask({
                  title: 'Improve task card readability',
                  priority: 'medium',
                })
              }
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Generate planner task
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Task Queue</h2>

          <div className="mt-4 space-y-3">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No tasks yet.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="font-medium text-white/90">
                        {task.title}
                      </div>

                      {task.title && (
                        <p className="text-sm text-white/60">
                          {task.title}
                        </p>
                      )}

                      <div className="text-xs text-white/40">
                        Status: {task.status}
                      </div>

                      <div className="text-xs text-white/40">
                        Assigned to: {getAgentName(task.assignedAgentId)}
                      </div>

                      <Link
                        href={`/changes?prompt=${encodeURIComponent(
                          getChangesPrompt(task)
                        )}`}
                        className="inline-block text-sm text-blue-400 underline underline-offset-4 hover:text-blue-300"
                      >
                        Send to Changes
                      </Link>
                    </div>

                    <div className="flex flex-col gap-2 sm:min-w-40">

                      {task.status === 'todo' && (
                        <button
                          onClick={() => executeTask({ taskId: task.id })}
                          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
                        >
                          Start
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => completeTask({ taskId: task.id })}
                          className="rounded-xl bg-green-400 px-4 py-2 text-sm font-medium text-black hover:bg-green-300"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}