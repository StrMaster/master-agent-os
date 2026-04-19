import { activeGoal } from "../lib/data";

const messages = [
  {
    role: "master",
    text: "Current focus: define shared data structures, then connect pages to a common source.",
  },
  {
    role: "user",
    text: "What is the next build step after multi-page navigation?",
  },
  {
    role: "master",
    text: "Create central types and mock data, then refactor all screens to consume shared state.",
  },
];

export default function ChatPage() {
  return (
    <section className="p-6 pb-24 md:p-8 lg:pb-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
          Master Chat
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Interactive Orchestrator
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Active goal: {activeGoal.title}
        </p>
      </header>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 md:p-6">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-3xl rounded-2xl p-4 text-sm leading-6 ${
                message.role === "master"
                  ? "bg-cyan-500/10 text-cyan-50 ring-1 ring-cyan-500/20"
                  : "ml-auto bg-zinc-800 text-zinc-100"
              }`}
            >
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
                {message.role}
              </p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            New message
          </p>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
            Type here later...
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
              Create Task
            </button>
            <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
              Create Agent
            </button>
            <button className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
              Send to Execution
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}