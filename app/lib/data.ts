export const activeGoal = {
  id: 'goal-1',
  title: 'Build Master Agent OS',
  description: 'Create an AI orchestration workspace with tasks, agents, and execution flows.',
  status: 'in_progress',
};

export const agents = [
  {
    id: 'agent-1',
    name: 'Alice',
    role: 'frontend',
    status: 'idle',
  },
  {
    id: 'agent-2',
    name: 'Bob',
    role: 'backend',
    status: 'active',
  },
];

export const executionRuns = [
  {
    id: 'run-1',
    taskId: 'task-1',
    status: 'completed',
    startedAt: '2024-01-01T10:00:00Z',
    endedAt: '2024-01-01T10:30:00Z',
  },
];

export const tasks = [
  {
    id: 'task-1',
    title: 'Create login page',
    priority: 'high',
    status: 'in_progress',
    subtasks: [
      { id: 'subtask-1', title: 'Design UI', done: true },
      { id: 'subtask-2', title: 'Implement form validation', done: false },
      { id: 'subtask-3', title: 'Connect authentication API', done: false },
    ],
  },
  {
    id: 'task-2',
    title: 'Set up database',
    priority: 'medium',
    status: 'todo',
    subtasks: [],
  },
];
