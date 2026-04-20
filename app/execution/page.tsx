'use client';

import { useState } from 'react';
import { useMasterStore } from '@/lib/master-store';

export default function ExecutionPage() {
  const {
    tasks,
    agents,
    sendToExecution,
    toggleSubtask,
    assignTaskToAgent,
  } = useMasterStore();

  const [isRunning, setIsRunning] = useState(false);

  async function runFirstTask() {
    
    const task = tasks[0];
    if (!task || isRunning) return;
     
    setIsRunning(true);

    try {
      sendToExecution({ targetType: 'task' });

      const availableAgent = agents[0];

if (task && availableAgent && !task.assignedAgentId) {
  assignTaskToAgent({
    taskId: task.id,
    agentId: availableAgent.id,
  });
}

      if (!task.subtasks || task.subtasks.length === 0) {
        return;
      }

      for (const subtask of task.subtasks) {
  if (subtask.done) continue;

  const res = await fetch('/api/master', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'execute-subtask',
      subtask: subtask.title,
    }),
  });

  const data = await res.json();

  console.log('AGENT RESPONSE', data);

  toggleSubtask({
    taskId: task.id,
    subtaskId: subtask.id,
  });

  await new Promise((r) => setTimeout(r, 500));
}
    } finally {
      setIsRunning(false);
    }
  }

  function activateFirstAgent() {
    if (isRunning) return;
    sendToExecution({ targetType: 'agent' });
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-semibold">Execution</h1>
        <p className="mb-6 text-white/60">Vykdymo valdymo sluoksnis.</p>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={runFirstTask}
            disabled={isRunning || tasks.length === 0}
            className="rounded-xl bg-white px-4 py-2 text-black transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? 'Vykdoma...' : 'Siųsti pirmą task į vykdymą'}
          </button>

          <button
            onClick={activateFirstAgent}
            disabled={agents.length === 0 || isRunning}
            className="rounded-xl border border-white/20 px-4 py-2 transition disabled:cursor-not-allowed disabled:opacity-50"
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
                tasks.map((task) => {
                  const completedCount =
                    task.subtasks?.filter((s) => s.done).length ?? 0;
                  const totalCount = task.subtasks?.length ?? 0;
                  const progress =
                    totalCount > 0
                      ? Math.round((completedCount / totalCount) * 100)
                      : 0;
                      const assignedAgent = agents.find(
  (a) => a.id === task.assignedAgentId
);
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                    >
                      <div className="font-medium">{task.title}</div>

                      <div className="mt-1 text-sm text-white/60">
                        {task.priority} · {task.status}
                        {assignedAgent && (
  <div className="mt-1 text-sm text-white/50">
    Assigned to: {assignedAgent.name}
  </div>
)}
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
                        <div className="mt-3 space-y-2">
                          {task.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                subtask.done
                                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                                  : 'border-white/10 text-white/70'
                              }`}
                            >
                              {subtask.done ? '✓' : '•'} {subtask.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
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