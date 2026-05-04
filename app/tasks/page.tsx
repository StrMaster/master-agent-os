'use client';

import { useMasterStore } from '@/lib/master-store';

export default function TasksPage() {
  const { tasks, toggleSubtask } = useMasterStore();

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-semibold">Tasks</h1>
        <p className="mb-6 text-white/60">
          Bendras Master Agent task sąrašas.
        </p>

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
              Kol kas taskų nėra.
            </div>
          ) : (
            tasks.map((task) => {
              const completedCount = task.subtasks?.filter((s) => s.done).length ?? 0;
              const totalCount = task.subtasks?.length ?? 0;
              const progress =
                totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-lg font-medium">{task.title}</div>

                  <div className="mt-2 text-sm text-white/60">
                    Priority: {task.priority} · Status: {task.status}
                  </div>

                  {totalCount > 0 && (
                    <div className="mt-3">
                      <div className="h-2 w-full rounded bg-white/10">
                        <div
                          className="h-2 rounded bg-blue-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {progress}% complete
                      </div>
                    </div>
                  )}

                  {task.subtasks?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {task.subtasks.map((subtask) => (
                        <button
                          key={subtask.id}
                          onClick={() =>
                            toggleSubtask({
                              taskId: task.id,
                              subtaskId: subtask.id,
                            })
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            subtask.done
                              ? 'border-green-500/40 bg-green-500/10 text-green-400'
                              : 'border-white/10 text-white/70 hover:bg-white/5'
                          }`}
                        >
                          {subtask.done ? '✓' : '•'} {subtask.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}