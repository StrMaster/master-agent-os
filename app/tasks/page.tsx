import { tasks } from "../lib/data";

const columns = ["backlog", "doing", "waiting", "done"] as const;

export default function TasksPage() {
  return (
    <section className="p-6 pb-24 md:p-8 lg:pb-8">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
          Tasks
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Work Board
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Track the system workflow from backlog to completion.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column);

          return (
            <div
              key={column}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold capitalize text-white">{column}</h3>
                <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <p className="text-sm font-medium text-zinc-100">{task.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{task.description}</p>
                    <p className="mt-3 text-xs text-zinc-500">
                      Agent: {task.assignedAgent} · Priority: {task.priority}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}