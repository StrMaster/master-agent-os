export type Priority = "low" | "medium" | "high";
export type RunnerHealthStatus = "healthy" | "degraded" | "blocked";

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
  waveStatus?: "ready" | "blocked" | "completed";
  previewOnly?: boolean;
  requiresApproval?: boolean;
  parentTaskId?: string;
  plannerNotes?: string;
  retryCount?: number;
  lastRetryAt?: string;
  targetFile?: string;
  status: AgentTaskStatus;
  priority?: Priority;
  dependsOn?: string[];
  dependsOnTaskIds?: string[];
  blockedBy?: string[];
  createdAt?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
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
  recoverySignature?: string;
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
  failedRuns?: number;
  lastFailureAt?: string;
  consecutiveFailures?: number;
  runtimeBlockedUntil?: string;
  runnerHealthStatus?: RunnerHealthStatus;
  recoveryAutoRunResumeEligible?: boolean;
  recoveryActive?: boolean;
};

export type GitHubFile = {
  sha: string;
  content: string;
};
