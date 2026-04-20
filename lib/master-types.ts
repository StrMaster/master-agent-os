export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type TaskItem = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
};

export type AgentItem = {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'active';
};

export type MasterAction =
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
        targetId?: string;
        note?: string;
      };
    }
  | {
      type: 'NONE';
      payload?: {};
    };

export type MasterResponse = {
  message: string;
  action: MasterAction;
};