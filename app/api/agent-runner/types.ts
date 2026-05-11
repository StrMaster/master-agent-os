export type Priority = "low" | "medium" | "high";

export type AgentTaskStatus =
  | "todo"
  | "running"
  | "done"
  | "failed"
  | "pending-pr";

export type AgentTask = {
  id: string;
  title: string;
  summary?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  parentTaskId?: string;
  plannerNotes?: string;
  retryCount?: number;
  lastRetryAt?: string;
  targetFile?: string;
  status: AgentTaskStatus;
  priority?: Priority;
  dependsOn?: string[];
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  result?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    merged?: boolean;
  };
  agentRole?: string;
  agentName?: string;
  agentSystemPrompt?: string;
  routingReason?: string;
  recoveryOfTaskId?: string;
  recoveryReason?: string;
};

export type AgentState = {
  paused?: boolean;
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
  recentFailedRuns?: number;
  recentValidationFailures?: number;
  recentMergeFailures?: number;
  recentDeployFailures?: number;
  recoveryActive?: boolean;
};

export type GitHubFile = {
  sha: string;
  content: string;
};
