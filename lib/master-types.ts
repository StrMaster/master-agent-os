export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type SubtaskItem = {
  id: string;
  title: string;
  done: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  subtasks: SubtaskItem[];
  assignedAgentId?: string;
};

export type AgentItem = {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'active';
  specialty?: 'frontend' | 'backend' | 'qa' | 'general';
};

export type MasterAction =
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
        subtasks?: string[];
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