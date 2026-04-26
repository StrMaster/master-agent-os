'use client';

import { useState } from 'react';
import { useMasterStore } from '@/lib/master-store';

export default function ExecutionPage() {
  const [logs, setLogs] = useState<string[]>([]);

  function addLog(message: string) {
    setLogs(prev => [message, ...prev]);
  }
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

      for (const subtask of task.subtasks || []) {
        if (subtask.done) continue;

        await fetch('/api/master', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'execute-subtask',
            subtask: subtask.title,
          }),
        });

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

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-4">TEST</h1>

      <button
        onClick={runFirstTask}
        className="bg-blue-500 px-4 py-2 rounded mb-4"
      >
        Run First Task
      </button>

      {tasks.map((task) => {
        const assigned = agents.find(
          (a) => a.id === task.assignedAgentId
        );

        return (
          <div key={task.id} className="mb-6 border p-4 rounded">
            <h2 className="text-xl">{task.title}</h2>

            <p className="text-sm text-gray-400">
              Assigned: {assigned?.name || 'None'}
            </p>

            <ul className="mt-2">
              {task.subtasks?.map((sub) => (
                <li
                  key={sub.id}
                  onClick={() =>
                    toggleSubtask({
                      taskId: task.id,
                      subtaskId: sub.id,
                    })
                  }
                  className={`cursor-pointer ${
                    sub.done ? 'line-through text-gray-500' : ''
                  }`}
                >
                  {sub.title}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
