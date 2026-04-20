'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { AgentItem, TaskItem } from '@/lib/master-types';

type MasterState = {
  tasks: TaskItem[];
  agents: AgentItem[];
};

type MasterContextValue = MasterState & {
  createTask: (input: {
    title: string;
    priority: 'low' | 'medium' | 'high';
  }) => void;
  createAgent: (input: {
    name: string;
    role: string;
  }) => void;
  sendToExecution: (input: {
    targetType: 'task' | 'agent';
  }) => void;
    breakdownTask: (input: {
    taskTitle: string;
    subtasks: string[];
  }) => void;
};

type Action =

  | {
    type: 'BREAKDOWN_TASK';
    payload: {
      taskTitle: string;
      subtasks: string[];
    };
  }

  | {
      type: 'CREATE_TASK';
      payload: {
        title: string;
        priority: 'low' | 'medium' | 'high';
      };
    }
  | {
      type: 'CREATE_AGENT';
      payload: {
        name: string;
        role: string;
      };
    }
  | {
      type: 'SEND_TO_EXECUTION';
      payload: {
        targetType: 'task' | 'agent';
      };
    };

function loadInitialState(): MasterState {
  if (typeof window === 'undefined') {
    return {
      tasks: [],
      agents: [],
    };
  }

  try {
    const raw = localStorage.getItem('master-store');

    if (!raw) {
      return {
        tasks: [],
        agents: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<MasterState>;

    return {
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task: any) => ({
            id: task.id ?? crypto.randomUUID(),
            title: task.title ?? 'Untitled Task',
            priority: task.priority ?? 'medium',
            status: task.status ?? 'todo',
            subtasks: Array.isArray(task.subtasks)
              ? task.subtasks.map((sub: any) => ({
                  id: sub.id ?? crypto.randomUUID(),
                  title: sub.title ?? 'Untitled Subtask',
                  done: Boolean(sub.done),
                }))
              : [],
          }))
        : [],
      agents: Array.isArray(parsed.agents)
        ? parsed.agents.map((agent: any) => ({
            id: agent.id ?? crypto.randomUUID(),
            name: agent.name ?? 'Untitled Agent',
            role: agent.role ?? 'general',
            status: agent.status ?? 'idle',
          }))
        : [],
    };
  } catch {
    return {
      tasks: [],
      agents: [],
    };
  }
}

const MasterStoreContext = createContext<MasterContextValue | null>(null);

function reducer(state: MasterState, action: Action): MasterState {
  switch (action.type) {
    case 'CREATE_TASK': {
  const newTask: TaskItem = {
    id: crypto.randomUUID(),
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
        : task
    ),
  };
}

    case 'CREATE_AGENT': {
      const newAgent: AgentItem = {
        id: crypto.randomUUID(),
        name: action.payload.name,
        role: action.payload.role,
        status: 'idle',
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
            index === 0 ? { ...task, status: 'in_progress' } : task
          ),
        };
      }

      return {
        ...state,
        agents: state.agents.map((agent, index) =>
          index === 0 ? { ...agent, status: 'active' } : agent
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

  const value = useMemo<MasterContextValue>(
    () => ({
        breakdownTask: (input) =>
  dispatch({
    type: 'BREAKDOWN_TASK',
    payload: input,
  }),
      tasks: state.tasks,
      agents: state.agents,
      createTask: (input) =>
        dispatch({
          type: 'CREATE_TASK',
          payload: input,
        }),
      createAgent: (input) =>
        dispatch({
          type: 'CREATE_AGENT',
          payload: input,
        }),
      sendToExecution: (input) =>
        dispatch({
          type: 'SEND_TO_EXECUTION',
          payload: input,
        }),
    }),
    [state]
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