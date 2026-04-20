'use client';

import { useMasterStore } from '@/lib/master-store';

export default function TasksPage() {
  const { tasks } = useMasterStore();

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-semibold">Tasks</h1>
        <p className="mb-6 text-white/60">Bendras Master Agent task sąrašas.</p>

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
              Kol kas taskų nėra.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-lg font-medium">{task.title}</div>
                <div className="mt-2 text-sm text-white/60">
                  Priority: {task.priority} · Status: {task.status}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}