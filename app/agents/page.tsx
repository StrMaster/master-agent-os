import { agents } from "../lib/data";

export default function AgentsPage() {
  return (
    <section className="p-6 pb-24 md:p-8 lg:pb-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
            Agents
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Agent Registry
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            View the active agents, their roles, current state, and latest outputs.
          </p>
        </div>

        <button className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
          New Agent
        </button>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{agent.name}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{agent.role}</p>
              </div>

              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/20">
                {agent.status}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-500">Current task:</span> {agent.currentTask}
              </p>
              <p>
                <span className="text-zinc-500">Last output:</span> {agent.lastOutput}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                Open
              </button>
              <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                Assign Task
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}