'use client';

import { useMasterStore } from '@/lib/master-store';

export default function TasksPage() {
  const { tasks, agents, createTask, executeTask, completeTask } =
    useMasterStore();

  function getAgentName(agentId?: string) {
    if (!agentId) return 'Unassigned';

    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? 'Unknown agent';
  }

  function getStatusLabel(status: string) {
    if (status === 'todo') return 'Todo';
    if (status === 'in_progress') return 'In progress';
    if (status === 'running') return 'Running';
    if (status === 'pending-pr') return 'Pending PR';
    if (status === 'failed') return 'Failed';
    if (status === 'done') return 'Done';

    return status;
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Tasks</h1>
          <p className="mt-2 text-sm text-white/60">
            Master Agent task queue for the PR-only execution flow.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/50">Stage 1</div>
          <div className="mt-1 text-lg font-medium">Task Queue Foundation</div>
          <p className="mt-2 text-sm text-white/60">
            Tasks should now move toward the agent-runner PR flow instead of the
            old Changes proposal/apply flow.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                const plannerTasks = [
                  'Improve Run Agent button microcopy',
                  'Refine task card spacing',
                  'Improve execution dashboard empty state',
                  'Clean ActivityFeed event labels',
                  'Improve pending PR status copy',
                ];

                const title =
                  plannerTasks[Math.floor(Math.random() * plannerTasks.length)];

                createTask({ title, priority: 'medium' });
              }}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Generate planner task
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
              Add sample task
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

                      <div className="text-xs text-white/40">
                        Priority: {task.priority}
                      </div>

                      <div className="text-xs text-white/40">
                        Status: {getStatusLabel(task.status)}
                      </div>

                      <div className="text-xs text-white/40">
                        Assigned to: {getAgentName(task.assignedAgentId)}
                      </div>

                     {task.branchName && (
  <div className="text-xs text-white/40">
    Branch: {task.branchName}
  </div>
)}

{task.pullRequestNumber && (
  <div className="text-xs text-white/40">
    PR: #{task.pullRequestNumber}
  </div>
)}

{task.pullRequestUrl && (
  <a
    href={task.pullRequestUrl}
    target="_blank"
    rel="noreferrer"
    className="inline-block text-sm text-blue-400 underline underline-offset-4 hover:text-blue-300"
  >
    Open pull request
  </a>
)}

                      {task.lastError && (
                        <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-xs text-red-200">
                          {task.lastError}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:min-w-40">
                      {task.status === 'todo' && (
                        <button
                          onClick={() => executeTask({ taskId: task.id })}
                          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
                        >
                          Mark running
                        </button>
                      )}

                      {(task.status === 'in_progress' || task.status === 'running') && (
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
