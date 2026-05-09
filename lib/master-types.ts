export type ChatRole = "user" | "assistant";

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

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "running"
  | "pending-pr"
  | "failed"
  | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskItem = {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: SubtaskItem[];
  assignedAgentId?: string;
  branchName?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  lastError?: string;
};

export type AgentItem = {
  id: string;
  name: string;
  role: string;
  status: "idle" | "active";
  specialty?: "frontend" | "backend" | "qa" | "general";
};

export type MasterAction =
  | {
      type: "BREAKDOWN_TASK";
      payload: {
        taskTitle: string;
        subtasks: string[];
      };
    }
  | {
      type: "CREATE_TASK";
      payload: {
        title: string;
        priority: TaskPriority;
      };
    }
  | {
      type: "CREATE_AGENT";
      payload: {
        name: string;
        role: string;
      };
    }
  | {
      type: "SEND_TO_EXECUTION";
      payload: {
        targetType: "task" | "agent";
        targetId?: string;
        note?: string;
      };
    }
  | {
      type: "NONE";
      payload?: Record<string, never>;
    };

export type MasterResponse = {
  message: string;
  action: MasterAction;
};
