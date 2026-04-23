export type TaskPriority = 'low' | 'medium' | 'high';

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  title: string;
  priority: TaskPriority;
  status: 'todo' | 'in_progress' | 'done';
  subtasks: Subtask[];
  assignedAgentId?: string;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
};

export type MasterAction =
  | {
      type: 'CREATE_TASK';
      payload: {
        title: string;
        priority: TaskPriority;
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