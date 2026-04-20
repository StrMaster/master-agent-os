'use client';

import React, { createContext, useContext, useMemo, useReducer } from 'react';
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
};

type Action =
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

const initialState: MasterState = {
  tasks: [],
  agents: [],
};

const MasterStoreContext = createContext<MasterContextValue | null>(null);

function reducer(state: MasterState, action: Action): MasterState {
  switch (action.type) {
    case 'CREATE_TASK': {
      const newTask: TaskItem = {
        id: crypto.randomUUID(),
        title: action.payload.title,
        priority: action.payload.priority,
        status: 'todo',
      };

      return {
        ...state,
        tasks: [newTask, ...state.tasks],
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
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<MasterContextValue>(
    () => ({
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