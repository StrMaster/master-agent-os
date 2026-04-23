import { create } from 'zustand';
import {
  Agent,
  LearningLogEntry,
  Subtask,
  Task,
  TaskPriority,
} from './master-types';

type CreateTaskInput = {
  title: string;
  priority: TaskPriority;
  subtasks?: string[];
};

type CreateAgentInput = {
  name: string;
  role: string;
};

type MasterStore = {
  tasks: Task[];
  agents: Agent[];
  learningLog: LearningLogEntry[];

  createTask: (input: CreateTaskInput) => void;
  createAgent: (input: CreateAgentInput) => void;
  addLearningLog: (entry: Omit<LearningLogEntry, 'id' | 'timestamp'>) => void;

  toggleSubtask: (taskId: string, subtaskId: string) => void;
  assignTaskToAgent: (taskId: string, agentId: string) => void;
  sendToExecution: (payload: { targetType: 'task' | 'agent'; note?: string }) => void;
};

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildDefaultSubtasks(title: string): string[] {
  const lower = title.toLowerCase();

  if (lower.includes('login')) {
    return [
      'Create login page layout',
      'Add email and password inputs',
      'Add validation states',
      'Connect authentication flow',
      'Add loading and error handling',
    ];
  }

  if (lower.includes('dashboard')) {
    return [
      'Create dashboard layout',
      'Add summary cards',
      'Connect shared data source',
      'Add responsive behavior',
      'Polish visual hierarchy',
    ];
  }

  if (lower.includes('mobile') || lower.includes('navigation') || lower.includes('sidebar')) {
    return [
      'Analyze current mobile layout issues',
      'Fix sidebar visibility and toggle behavior',
      'Prevent horizontal overflow',
      'Improve responsive layout and spacing',
    ];
  }

  return [
    'Define scope',
    'Create first UI version',
    'Connect core logic',
    'Test key flows',
  ];
}

function toSubtasks(input: string[]): Subtask[] {
  return input.map((title) => ({
    id: makeId('subtask'),
    title,
    done: false,
  }));
}

export const useMasterStore = create<MasterStore>((set) => ({
  tasks: [],
  agents: [],
  learningLog: [],

  createTask: ({ title, priority, subtasks }) =>
    set((state) => {
      const finalSubtasks =
        subtasks && subtasks.length > 0 ? subtasks : buildDefaultSubtasks(title);

      const newTask: Task = {
        id: makeId('task'),
        title,
        priority,
        status: 'todo',
        subtasks: toSubtasks(finalSubtasks),
      };

      return {
        tasks: [...state.tasks, newTask],
      };
    }),

  createAgent: ({ name, role }) =>
    set((state) => {
      const newAgent: Agent = {
        id: makeId('agent'),
        name,
        role,
      };

      return {
        agents: [...state.agents, newAgent],
      };
    }),

  addLearningLog: (entry) =>
    set((state) => {
      const next: LearningLogEntry = {
        id: makeId('log'),
        timestamp: new Date().toISOString(),
        ...entry,
      };

      return {
        learningLog: [next, ...state.learningLog].slice(0, 50),
      };
    }),

  assignTaskToAgent: (taskId, agentId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, assignedAgentId: agentId } : task
      ),
    })),

  sendToExecution: () => {},

  toggleSubtask: (taskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const updatedSubtasks = task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
        );

        const allDone =
          updatedSubtasks.length > 0 && updatedSubtasks.every((subtask) => subtask.done);

        return {
          ...task,
          subtasks: updatedSubtasks,
          status: allDone ? 'done' : 'todo',
        };
      }),
    })),
}));