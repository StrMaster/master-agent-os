'use client';

import { useMasterStore } from '@/lib/master-store';
import PendingPRQueue from "../components/PendingPRQueue";



export default function ExecutionPage() {
  const { tasks, agents, executeTask, completeTask } = useMasterStore();

  const runningTasks = tasks.filter(
  (task) => task.status === 'in_progress' || task.status === 'running',
);

const pendingPrTasks = tasks.filter((task) => task.status === 'pending-pr');
const failedTasks = tasks.filter((task) => task.status === 'failed');
const completedTasks = tasks.filter((task) => task.status === 'done');
const todoTasks = tasks.filter((task) => task.status === 'todo');

  function getAgentName(agentId?: string) {
    if (!agentId) return 'Unassigned';

    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? 'Unknown agent';
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Execution</h1>
          <p className="mt-2 text-sm text-white/60">
            Manage and monitor task execution.
          </p>
        </div>

        <PendingPRQueue />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Running</h2>

          <div className="mt-4 space-y-3">
            {runningTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No tasks are currently running. Start a task to see its progress here.
              </div>
            ) : (
              runningTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-green-500/30 bg-green-500/10 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-green-100">
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-green-100/70">
                        Assigned to: {getAgentName(task.assignedAgentId)}
                      </div>
                      <div className="mt-1 text-xs text-green-100/70">
                        Status: {task.status}
                      </div>
                    </div>

                    <button
                      onClick={() => completeTask({ taskId: task.id })}
                      className="rounded-xl bg-green-400 px-4 py-2 text-sm font-medium text-black hover:bg-green-300"
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
  <h2 className="text-lg font-semibold">Pending PR</h2>

  <div className="mt-4 space-y-3">
    {pendingPrTasks.length === 0 ? (
      <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
        No tasks are waiting for PR review.
      </div>
    ) : (
      pendingPrTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4"
        >
          <div className="font-medium text-blue-100">{task.title}</div>
          <div className="mt-1 text-xs text-blue-100/70">
            Assigned to: {getAgentName(task.assignedAgentId)}
          </div>
          <div className="mt-1 text-xs text-blue-100/70">
            Status: pending-pr
          </div>

          {task.pullRequestUrl && (
            <a
              href={task.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-blue-300 underline underline-offset-4 hover:text-blue-200"
            >
              Open pull request
            </a>
          )}
        </div>
      ))
    )}
  </div>
</section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Todo</h2>

          <div className="mt-4 space-y-3">
            {todoTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No pending tasks at the moment. Please add new tasks to get started.
              </div>
            ) : (
              todoTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-white/90">
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Assigned to: {getAgentName(task.assignedAgentId)}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Status: todo
                      </div>
                    </div>

                    <button
                      onClick={() => executeTask({ taskId: task.id })}
                      className="rounded-xl border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/20"
                    >
                      Run task
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
  <h2 className="text-lg font-semibold">Failed</h2>

  <div className="mt-4 space-y-3">
    {failedTasks.length === 0 ? (
      <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
        No failed tasks.
      </div>
    ) : (
      failedTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <div className="font-medium text-red-100">{task.title}</div>
          <div className="mt-1 text-xs text-red-100/70">
            Assigned to: {getAgentName(task.assignedAgentId)}
          </div>
          <div className="mt-1 text-xs text-red-100/70">
            Status: failed
          </div>

          {task.lastError && (
            <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-xs text-red-100">
              {task.lastError}
            </div>
          )}
        </div>
      ))
    )}
  </div>
</section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Completed</h2>

          <div className="mt-4 space-y-3">
            {completedTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No tasks have been completed yet. Completed tasks will appear here once finished.
              </div>
            ) : (
              completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                >
                  <div className="font-medium text-white/80">{task.title}</div>
                  <div className="mt-1 text-xs text-white/50">
                    Assigned to: {getAgentName(task.assignedAgentId)}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Status: done
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