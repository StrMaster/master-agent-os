'use client';

import { useState } from 'react';
import { TaskItem } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

function buildProposalPrompt(task: any) {
  return `Modify only one file.
Keep changes minimal and focused.
Do not rewrite entire components.
Return code diff only.

Implement this task:
${task.title}

Subtasks:
${task.subtasks?.map((s: any) => `- ${s.title}`).join('\n') || '- No subtasks'}`;
}

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
    completeTask,
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

  const runningTask = tasks.find(task => task.status === 'in_progress');

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-4">TEST</h1>

      <button
        onClick={runFirstTask}
        className="bg-blue-500 px-4 py-2 rounded mb-4"
      >
        Run First Task
      </button>

      <div className="mb-4">
        {runningTask ? `Running: ${runningTask.title}` : 'Idle'}
        {runningTask && (
          <>
            <button
              onClick={() => {
                const prompt = `Implement this task:\n${runningTask.title}\n\nSubtasks:\n${(runningTask.subtasks || []).map(st => `- ${st.title}`).join('\n')}`;
                window.location.href = `/changes?prompt=${encodeURIComponent(prompt)}`;
              }}
              className="ml-4 bg-green-500 px-3 py-1 rounded text-sm"
            >
              Create proposal
            </button>
            <button
              onClick={() => {
                const prompt = `Implement this task:\n${runningTask.title}\n\nSubtasks:\n${(runningTask.subtasks || []).map(st => `- ${st.title}`).join('\n')}`;
                window.location.href = `/changes?prompt=${encodeURIComponent(prompt)}`;
              }}
              className="ml-2 bg-yellow-500 px-3 py-1 rounded text-sm"
            >
              Auto proposal
            </button>
          </>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Activity</h3>
        {tasks.some(task => task.status === 'in_progress') ? (
          tasks.filter(task => task.status === 'in_progress').map(task => (
            <div key={task.id} className="text-sm">
  <div>{task.title} is currently in progress</div>

  <button
    onClick={() => completeTask({ taskId: task.id })}
    className="mt-2 rounded-lg border border-white/20 px-3 py-1 text-xs"
  >
    Complete task
  </button>
</div>
          ))
        ) : (
          <p className="text-sm">No active execution.</p>
        )}
      </div>

      {tasks.map((task) => {
        const assigned = agents.find(
          (a) => a.id === task.assignedAgentId
        );

        const logMessage = `${assigned?.name || 'Unknown agent'} started: ${task.title || 'Unknown task'}`;

        return (
          <div key={task.id} className="mb-6 border p-4 rounded">
            <h2 className="text-xl">{task.title}</h2>
            <p className="text-sm">Status: {task.status}</p>

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
