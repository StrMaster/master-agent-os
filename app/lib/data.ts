export const activeGoal = {
  id: 'goal-1',
  title: 'Launch Master Agent OS MVP',
  description: 'Stabilize the core workflow, mobile UI, and execution pipeline.',
  status: 'active',
};

export const agents = [
  {
    id: 'agent-1',
    name: 'Master Agent',
    role: 'CEO / Orchestrator',
    status: 'active',
  },
  {
    id: 'agent-2',
    name: 'Frontend Agent',
    role: 'UI and UX implementation',
    status: 'active',
  },
  {
    id: 'agent-3',
    name: 'Execution Agent',
    role: 'Task execution and automation',
    status: 'idle',
  },
];

export const executionRuns = [
  {
    id: 'run-1',
    title: 'Mobile UI stabilization',
    status: 'running',
  },
  {
    id: 'run-2',
    title: 'Master API cleanup',
    status: 'queued',
  },
  {
    id: 'run-3',
    title: 'Dashboard polish',
    status: 'completed',
  },
];

export const tasks = [
  {
    id: 'task-1',
    title: 'Improve mobile navigation',
    description: 'Fix sidebar behavior, overflow issues, and mobile usability.',
    status: 'doing',
    priority: 'high',
  },
  {
    id: 'task-2',
    title: 'Stabilize Master API intent detection',
    description: 'Ensure questions do not create tasks and explicit commands do.',
    status: 'backlog',
    priority: 'high',
  },
  {
    id: 'task-3',
    title: 'Polish changes page UX',
    description: 'Make proposal generation and apply flow easier on mobile.',
    status: 'todo',
    priority: 'medium',
  },
  {
    id: 'task-4',
    title: 'Prepare self-improving v1 safely',
    description: 'Add logging and review without automatic self-modification.',
    status: 'done',
    priority: 'medium',
  },
];