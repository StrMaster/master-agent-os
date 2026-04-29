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
    <div className="p-6 text-white bg-gray-900 rounded-lg shadow-lg space-y-8">
      <h1 className="text-2xl mb-4">TEST</h1>

      <button
        onClick={runFirstTask}
        className="bg-blue-500 px-4 py-2 rounded mb-4"
      >
        Run First Task
      </button>

      <div className="mb-8 border border-gray-700 rounded-lg p-4 bg-gray-800">
        <h2 className="text-2xl font-bold mb-3 text-yellow-400">
          {runningTask ? `Running: ${runningTask.title}` : 'Idle'}
        </h2>
        {runningTask && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const prompt = `Implement this task:\n${runningTask.title}\n\nSubtasks:\n${(runningTask.subtasks || []).map(st => `- ${st.title}`).join('\n')}`;
                window.location.href = `/changes?prompt=${encodeURIComponent(prompt)}`;
              }}
              className="bg-green-500 px-3 py-1 rounded text-sm"
            >
              Create proposal
            </button>
            <button
              onClick={() => {
                const prompt = `Implement this task:\n${runningTask.title}\n\nSubtasks:\n${(runningTask.subtasks || []).map(st => `- ${st.title}`).join('\n')}`;
                window.location.href = `/changes?prompt=${encodeURIComponent(prompt)}`;
              }}
              className="bg-yellow-500 px-3 py-1 rounded text-sm"
            >
              Auto proposal
            </button>
            <button
              onClick={() => {
                let prompt = `Implement this task:\n${runningTask.title}\n\nSubtasks:\n${(runningTask.subtasks || []).map(st => `- ${st.title}`).join('\n')}`;
                prompt += "\nAfter generating a safe proposal, create a PR. Do not merge automatically.";
                window.location.href = `/changes?prompt=${encodeURIComponent(prompt)}`;
              }}
              className="bg-purple-600 px-3 py-1 rounded text-sm"
            >
              Start auto loop
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Activity</h3>
        <div className="mt-6">
  <h2 className="text-lg font-semibold mb-2">Completed</h2>

  {tasks.filter((task) => task.status === 'done').length === 0 ? (
    <p className="text-sm text-white/60">No completed tasks yet.</p>
  ) : (
    tasks
      .filter((task) => task.status === 'done')
      .map((task) => {
        const agent = agents.find(
          (a) => a.id === task.assignedAgentId
        );

        return (
          <p key={task.id} className="text-sm">
            {agent ? agent.name : 'Unassigned'} finished: {task.title}
          </p>
        );
      })
  )}
</div>
        {tasks.some(task => task.status === 'in_progress') ? (
          tasks.filter(task => task.status === 'in_progress').map(task => (
            <div key={task.id} className="text-sm">
  {
  (() => {
    const assignedAgent = agents.find(a => a.id === task.assignedAgentId);
    return (
      <div>
        {assignedAgent ? `${assignedAgent.name} working on: ${task.title}` : `Unassigned working on: ${task.title}`}
      </div>
    );
  })()
}

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
          <div key={task.id} className={`mb-8 border-4 p-8 rounded-lg bg-gray-800 ${task.status === 'in_progress' ? 'border-yellow-400 bg-yellow-900' : 'border-gray-600'} space-y-4`}>
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
