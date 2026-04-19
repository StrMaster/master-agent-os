import { executionRuns } from "../lib/data";

export default function ExecutionPage() {
  return (
    <section className="p-6 pb-24 md:p-8 lg:pb-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
          Execution
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Prompt Run Panel
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          This is the bridge between the orchestration layer and external execution.
        </p>
      </header>

      <div className="space-y-4">
        {executionRuns.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-zinc-500">Source</p>
                <h3 className="text-xl font-semibold text-white">{item.source}</h3>
              </div>

              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/20">
                {item.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Prompt
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{item.prompt}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Response
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{item.response}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                Copy Prompt
              </button>
              <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                Mark Sent
              </button>
              <button className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
                Complete Run
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}