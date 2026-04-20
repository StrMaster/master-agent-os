'use client';

import { useMasterStore } from '@/lib/master-store';

export default function ExecutionPage() {
  const { tasks, agents, sendToExecution } = useMasterStore();

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-semibold">Execution</h1>
        <p className="mb-6 text-white/60">Vykdymo valdymo sluoksnis.</p>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => sendToExecution({ targetType: 'task' })}
            className="rounded-xl bg-white px-4 py-2 text-black"
          >
            Siųsti pirmą task į vykdymą
          </button>

          <button
            onClick={() => sendToExecution({ targetType: 'agent' })}
            className="rounded-xl border border-white/20 px-4 py-2"
          >
            Aktyvuoti pirmą agentą
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 text-xl font-semibold">Tasks</h2>
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-white/60">Taskų nėra.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                  >
                    <div className="font-medium">{task.title}</div>
                    <div className="mt-1 text-sm text-white/60">
                      {task.priority} · {task.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 text-xl font-semibold">Agents</h2>
            <div className="space-y-3">
              {agents.length === 0 ? (
                <p className="text-white/60">Agentų nėra.</p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="mt-1 text-sm text-white/60">
                      {agent.role} · {agent.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}