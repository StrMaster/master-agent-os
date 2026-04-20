'use client';

import { useMasterStore } from '@/lib/master-store';

export default function AgentsPage() {
  const { agents } = useMasterStore();

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-semibold">Agents</h1>
        <p className="mb-6 text-white/60">Bendras Master Agent agentų sąrašas.</p>

        <div className="space-y-4">
          {agents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
              Kol kas agentų nėra.
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-lg font-medium">{agent.name}</div>
                <div className="mt-2 text-sm text-white/60">
                  Role: {agent.role} · Status: {agent.status}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}