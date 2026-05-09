export type StopConditionInput = {
  emergencyStop?: boolean;
  paused?: boolean;
  autoRunEnabled?: boolean;
  recentFailedRuns?: number;
  recentValidationFailures?: number;
  recentMergeFailures?: number;
  recentDeployFailures?: number;
  recoveryActive?: boolean;
};

export type StopConditionResult = {
  stop: boolean;
  reason?: string;
  code?: string;
};

const MAX_RECENT_FAILED_RUNS = 3;
const MAX_RECENT_VALIDATION_FAILURES = 3;
const MAX_RECENT_MERGE_FAILURES = 2;
const MAX_RECENT_DEPLOY_FAILURES = 1;

export function evaluateStopConditions(
  input: StopConditionInput,
): StopConditionResult {
  if (input.emergencyStop) {
    return {
      stop: true,
      code: "emergency-stop",
      reason: "Emergency stop is active",
    };
  }

  if (input.paused) {
    return {
      stop: true,
      code: "paused",
      reason: "Agent is paused",
    };
  }

  if (input.recoveryActive) {
    return {
      stop: true,
      code: "recovery-active",
      reason: "Recovery is active",
    };
  }

  if ((input.recentFailedRuns ?? 0) >= MAX_RECENT_FAILED_RUNS) {
    return {
      stop: true,
      code: "too-many-failed-runs",
      reason: "Too many recent failed runs",
    };
  }

  if (
    (input.recentValidationFailures ?? 0) >=
    MAX_RECENT_VALIDATION_FAILURES
  ) {
    return {
      stop: true,
      code: "too-many-validation-failures",
      reason: "Too many recent validation failures",
    };
  }

  if ((input.recentMergeFailures ?? 0) >= MAX_RECENT_MERGE_FAILURES) {
    return {
      stop: true,
      code: "too-many-merge-failures",
      reason: "Too many recent merge failures",
    };
  }

  if ((input.recentDeployFailures ?? 0) >= MAX_RECENT_DEPLOY_FAILURES) {
    return {
      stop: true,
      code: "deploy-failure-threshold",
      reason: "Deploy failure threshold reached",
    };
  }

  return {
    stop: false,
  };
}