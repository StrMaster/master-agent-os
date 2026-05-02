'use client';

import { useMasterStore } from '@/lib/master-store';

export default function ExecutionPage() {
  const { tasks, agents, executeTask, completeTask } = useMasterStore();

  const runningTasks = tasks.filter((task) => task.status === 'in_progress');
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
            Run assigned tasks and track progress.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Running</h2>

          <div className="mt-4 space-y-3">
            {runningTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                Nothing running right now.
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
                        Status: in_progress
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
          <h2 className="text-lg font-semibold">Todo</h2>

          <div className="mt-4 space-y-3">
            {todoTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No todo tasks.
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
                      className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
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
          <h2 className="text-lg font-semibold">Completed</h2>

          <div className="mt-4 space-y-3">
            {completedTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/50">
                No completed tasks.
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