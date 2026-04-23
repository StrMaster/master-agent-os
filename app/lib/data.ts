export const activeGoal = {
  id: 'goal-1',
  title: 'Launch MVP',
  description: 'Complete the minimum viable product for initial release.',
  status: 'in_progress',
};

export const agents = [
  {
    id: 'agent-1',
    name: 'Alice',
    role: 'frontend',
    status: 'active',
  },
  {
    id: 'agent-2',
    name: 'Bob',
    role: 'backend',
    status: 'idle',
  },
  {
    id: 'agent-3',
    name: 'Charlie',
    role: 'qa',
    status: 'idle',
  },
];

export const executionRuns = [
  {
    id: 'run-1',
    taskId: 'task-1',
    status: 'completed',
    startedAt: '2024-04-01T10:00:00Z',
    finishedAt: '2024-04-01T12:00:00Z',
  },
  {
    id: 'run-2',
    taskId: 'task-2',
    status: 'in_progress',
    startedAt: '2024-04-02T09:30:00Z',
  },
];

export const tasks = [
  {
    id: 'task-1',
    title: 'Create login page',
    priority: 'high',
    status: 'done',
    subtasks: [
      { id: 'subtask-1', title: 'Design UI', done: true },
      { id: 'subtask-2', title: 'Implement form', done: true },
      { id: 'subtask-3', title: 'Connect API', done: true },
    ],
    assignedAgentId: 'agent-1',
  },
  {
    id: 'task-2',
    title: 'Setup backend API',
    priority: 'medium',
    status: 'in_progress',
    subtasks: [
      { id: 'subtask-4', title: 'Define endpoints', done: true },
      { id: 'subtask-5', title: 'Implement handlers', done: false },
      { id: 'subtask-6', title: 'Write tests', done: false },
    ],
    assignedAgentId: 'agent-2',
  },
  {
    id: 'task-3',
    title: 'QA testing',
    priority: 'low',
    status: 'todo',
    subtasks: [],
    assignedAgentId: 'agent-3',
  },
];
