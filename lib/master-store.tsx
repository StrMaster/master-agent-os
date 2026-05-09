'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import { AgentItem, TaskItem, TaskPriority, TaskStatus } from '@/lib/master-types';

type MasterState = {
  tasks: TaskItem[];
  agents: AgentItem[];
};

type MasterContextValue = MasterState & {
  executeTask: (input: { taskId: string }) => void;
  completeTask: (input: { taskId: string }) => void;
  failTask: (input: { taskId: string; error?: string }) => void;
  markTaskPendingPr: (input: {
    taskId: string;
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
  }) => void;
  createTask: (input: { title: string; priority: TaskPriority }) => string;
  createAgent: (input: { name: string; role: string }) => void;
  sendToExecution: (input: { targetType: 'task' | 'agent' }) => void;
  breakdownTask: (input: { taskTitle: string; subtasks: string[] }) => void;
  toggleSubtask: (input: { taskId: string; subtaskId: string }) => void;
  autoAssignTask: (input: { taskId: string }) => void;
  assignTaskToAgent: (input: { taskId: string; agentId: string }) => void;
};

type Action =
  | { type: 'AUTO_ASSIGN_TASK'; payload: { taskId: string } }
  | { type: 'ASSIGN_TASK_TO_AGENT'; payload: { taskId: string; agentId: string } }
  | { type: 'EXECUTE_TASK'; payload: { taskId: string } }
  | { type: 'COMPLETE_TASK'; payload: { taskId: string } }
  | { type: 'FAIL_TASK'; payload: { taskId: string; error?: string } }
  | {
      type: 'MARK_TASK_PENDING_PR';
      payload: {
        taskId: string;
        branchName?: string;
        pullRequestUrl?: string;
        pullRequestNumber?: number;
      };
    }
  | { type: 'TOGGLE_SUBTASK'; payload: { taskId: string; subtaskId: string } }
  | { type: 'BREAKDOWN_TASK'; payload: { taskTitle: string; subtasks: string[] } }
  | {
      type: 'CREATE_TASK';
      payload: { id: string; title: string; priority: TaskPriority };
    }
  | { type: 'CREATE_AGENT'; payload: { name: string; role: string } }
  | { type: 'SEND_TO_EXECUTION'; payload: { targetType: 'task' | 'agent' } };

function normalizeTaskStatus(status: unknown): TaskStatus {
  if (
    status === 'todo' ||
    status === 'in_progress' ||
    status === 'running' ||
    status === 'pending-pr' ||
    status === 'failed' ||
    status === 'done'
  ) {
    return status;
  }

  return 'todo';
}

function loadInitialState(): MasterState {
  if (typeof window === 'undefined') {
    return { tasks: [], agents: [] };
  }

  try {
    const raw = localStorage.getItem('master-store');

    if (!raw) {
      return { tasks: [], agents: [] };
    }

    const parsed = JSON.parse(raw) as Partial<MasterState>;

    return {
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task: any) => ({
            id: task.id ?? crypto.randomUUID(),
            title: task.title ?? 'Untitled Task',
            priority: task.priority ?? 'medium',
            status: normalizeTaskStatus(task.status),
            subtasks: Array.isArray(task.subtasks)
              ? task.subtasks.map((sub: any) => ({
                  id: sub.id ?? crypto.randomUUID(),
                  title: sub.title ?? 'Untitled Subtask',
                  done: Boolean(sub.done),
                }))
              : [],
            assignedAgentId: task.assignedAgentId,
            branchName: task.branchName,
            pullRequestUrl: task.pullRequestUrl,
            pullRequestNumber: task.pullRequestNumber,
            lastError: task.lastError,
          }))
        : [],
      agents: Array.isArray(parsed.agents)
        ? parsed.agents.map((agent: any) => ({
            id: agent.id ?? crypto.randomUUID(),
            name: agent.name ?? 'Untitled Agent',
            role: agent.role ?? 'general',
            status: agent.status === 'active' ? 'active' : 'idle',
            specialty: agent.specialty,
          }))
        : [],
    };
  } catch {
    return { tasks: [], agents: [] };
  }
}

const MasterStoreContext = createContext<MasterContextValue | null>(null);

function reducer(state: MasterState, action: Action): MasterState {
  switch (action.type) {
    case 'CREATE_TASK': {
      const newTask: TaskItem = {
        id: action.payload.id,
        title: action.payload.title,
        priority: action.payload.priority,
        status: 'todo',
        subtasks: [],
      };

      return {
        ...state,
        tasks: [newTask, ...state.tasks],
      };
    }

    case 'AUTO_ASSIGN_TASK': {
      const task = state.tasks.find((t) => t.id === action.payload.taskId);
      if (!task) return state;

      const title = task.title.toLowerCase();

      const frontendKeywords = ['login', 'page', 'ui', 'dashboard', 'layout', 'frontend'];
      const backendKeywords = ['api', 'auth', 'database', 'backend', 'server', 'db'];
      const qaKeywords = ['test', 'qa', 'validation', 'bug', 'check'];

      let preferredRole = 'general';

      if (frontendKeywords.some((keyword) => title.includes(keyword))) {
        preferredRole = 'frontend';
      } else if (backendKeywords.some((keyword) => title.includes(keyword))) {
        preferredRole = 'backend';
      } else if (qaKeywords.some((keyword) => title.includes(keyword))) {
        preferredRole = 'qa';
      }

      const preferredAgent =
        state.agents.find((agent) =>
          agent.role.toLowerCase().includes(preferredRole),
        ) ?? state.agents[0];

      if (!preferredAgent) return state;

      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? { ...t, assignedAgentId: preferredAgent.id }
            : t,
        ),
      };
    }

    case 'ASSIGN_TASK_TO_AGENT': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? { ...task, assignedAgentId: action.payload.agentId }
            : task,
        ),
      };
    }

    case 'TOGGLE_SUBTASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.payload.taskId) return task;

          const updatedSubtasks = task.subtasks.map((subtask) =>
            subtask.id === action.payload.subtaskId
              ? { ...subtask, done: !subtask.done }
              : subtask,
          );

          const hasStarted = updatedSubtasks.some((subtask) => subtask.done);
          const allDone =
            updatedSubtasks.length > 0 && updatedSubtasks.every((subtask) => subtask.done);

          return {
            ...task,
            subtasks: updatedSubtasks,
            status: allDone ? 'done' : hasStarted ? 'in_progress' : 'todo',
          };
        }),
      };
    }

    case 'BREAKDOWN_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.title.toLowerCase() === action.payload.taskTitle.toLowerCase()
            ? {
                ...task,
                subtasks: action.payload.subtasks.map((title) => ({
                  id: crypto.randomUUID(),
                  title,
                  done: false,
                })),
              }
            : task,
        ),
      };
    }

    case 'CREATE_AGENT': {
      const newAgent: AgentItem = {
        id: crypto.randomUUID(),
        name: action.payload.name,
        role: action.payload.role,
        status: 'idle',
        specialty: undefined,
      };

      return {
        ...state,
        agents: [newAgent, ...state.agents],
      };
    }

    case 'SEND_TO_EXECUTION': {
      if (action.payload.targetType === 'task') {
        return {
          ...state,
          tasks: state.tasks.map((task, index) =>
            index === 0 ? { ...task, status: 'running' } : task,
          ),
        };
      }

      return {
        ...state,
        agents: state.agents.map((agent, index) =>
          index === 0 ? { ...agent, status: 'active' } : agent,
        ),
      };
    }

    case 'EXECUTE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? { ...task, status: 'running', lastError: undefined }
            : task,
        ),
      };
    }

    case 'MARK_TASK_PENDING_PR': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? {
                ...task,
                status: 'pending-pr',
                branchName: action.payload.branchName ?? task.branchName,
                pullRequestUrl: action.payload.pullRequestUrl ?? task.pullRequestUrl,
                pullRequestNumber:
                  action.payload.pullRequestNumber ?? task.pullRequestNumber,
                lastError: undefined,
              }
            : task,
        ),
      };
    }

    case 'FAIL_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? {
                ...task,
                status: 'failed',
                lastError: action.payload.error ?? 'Task failed',
              }
            : task,
        ),
      };
    }

    case 'COMPLETE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? { ...task, status: 'done', lastError: undefined }
            : task,
        ),
      };
    }

    default:
      return state;
  }
}

export function MasterStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem('master-store', JSON.stringify(state));
    } catch {}
  }, [state]);

  const value = useMemo(
    () => ({
      tasks: state.tasks,
      agents: state.agents,
      assignTaskToAgent: (input: { taskId: string; agentId: string }) =>
        dispatch({ type: 'ASSIGN_TASK_TO_AGENT', payload: input }),
      autoAssignTask: (input: { taskId: string }) =>
        dispatch({ type: 'AUTO_ASSIGN_TASK', payload: input }),
      toggleSubtask: (input: { taskId: string; subtaskId: string }) =>
        dispatch({ type: 'TOGGLE_SUBTASK', payload: input }),
      breakdownTask: (input: { taskTitle: string; subtasks: string[] }) =>
        dispatch({ type: 'BREAKDOWN_TASK', payload: input }),
      createTask: (input: { title: string; priority: TaskPriority }) => {
        const id = crypto.randomUUID();
        dispatch({ type: 'CREATE_TASK', payload: { id, ...input } });
        return id;
      },
      createAgent: (input: { name: string; role: string }) =>
        dispatch({ type: 'CREATE_AGENT', payload: input }),
      sendToExecution: (input: { targetType: 'task' | 'agent' }) =>
        dispatch({ type: 'SEND_TO_EXECUTION', payload: input }),
      executeTask: (input: { taskId: string }) =>
        dispatch({ type: 'EXECUTE_TASK', payload: input }),
      completeTask: (input: { taskId: string }) =>
        dispatch({ type: 'COMPLETE_TASK', payload: input }),
      failTask: (input: { taskId: string; error?: string }) =>
        dispatch({ type: 'FAIL_TASK', payload: input }),
      markTaskPendingPr: (input: {
        taskId: string;
        branchName?: string;
        pullRequestUrl?: string;
        pullRequestNumber?: number;
      }) => dispatch({ type: 'MARK_TASK_PENDING_PR', payload: input }),
    }),
    [state],
  );

  return (
    <MasterStoreContext.Provider value={value}>
      {children}
    </MasterStoreContext.Provider>
  );
}

export function useMasterStore() {
  const ctx = useContext(MasterStoreContext);

  if (!ctx) {
    throw new Error('useMasterStore must be used inside MasterStoreProvider');
  }

  return ctx;
}
