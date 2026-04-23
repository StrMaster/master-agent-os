export type TaskPriority = 'low' | 'medium' | 'high';

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
      type: 'BREAKDOWN_TASK';
      payload: {
        title: string;
        subtasks: string[];
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
      type: 'SHOW_LEARNING_LOG';
      payload?: {};
    }
  | {
      type: 'NONE';
      payload?: {};
    };

export type MasterResponse = {
  message: string;
  action: MasterAction;
};