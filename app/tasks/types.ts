export type AgentTask = {
  id: string;
  title?: string;
  summary?: string;
  status?: string;
  priority?: "low" | "medium" | "high";
  source?: string;
  targetFile?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  waveStatus?: "ready" | "blocked" | "completed";
  parentTaskId?: string;
  plannerNotes?: string;
  retryCount?: number;
  lastRetryAt?: string;
  error?: string;
  createdAt?: string;
  result?: {
    branchName?: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
    merged?: boolean;
  };
};

export type SafetyReview = {
  label: string;
  passed: boolean;
};
