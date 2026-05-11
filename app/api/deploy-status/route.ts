import { NextResponse } from "next/server";
import { createRecoveryTask, readTasksFile } from "../agent-runner/tasks";
import { recordRuntimeDeployMemory } from "../agent-runner/memory";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";

const PROJECT_NAME = "master-agent-os";
const STATE_PATH = ".agent/state.json";
const ACTIVITY_PATH = ".agent/activity.json";

type GitHubFile = {
  sha: string;
  content: string;
};

type AgentState = {
  recentDeployFailures?: number;
  deployStatus?: "pending" | "success" | "failed";
  deployStartedAt?: string;
  deployCompletedAt?: string;
  deployError?: string;
  lastDeployUrl?: string;
  recoveryActive?: boolean;
  autoRunEnabled?: boolean;
  recoveryAutoRunResumeEligible?: boolean;
  overnightModeActive?: boolean;
  overnightSessionStartedAt?: string;
  overnightSessionCompletedAt?: string;
  overnightSessionStopReason?: string;
  overnightTasksCompleted?: number;
  overnightPrsCreated?: number;
  overnightFailures?: number;
  overnightRecoveries?: number;
  overnightMaxTasks?: number;
  overnightMaxPrs?: number;
  overnightMaxFailures?: number;
  overnightMaxRecoveryAttempts?: number;
  overnightMaxDurationMs?: number;
};

type DeployStatus = "pending" | "success" | "failed";

async function readGithubJson(path: string, fallback: unknown) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return {
      json: fallback,
      sha: null,
    };
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    json: JSON.parse(content),
    sha: file.sha,
  };
}

async function writeGithubJson(
  path: string,
  json: unknown,
  sha: string,
  message: string,
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64",
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content,
        sha,
        branch: BRANCH,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${path}: ${res.status} ${text}`);
  }
}

async function logActivity(event: Record<string, unknown>) {
  const { json, sha } = await readGithubJson(ACTIVITY_PATH, []);

  if (!sha) return;

  const activity = Array.isArray(json) ? json : [];

  const updatedActivity = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...activity,
  ].slice(0, 150);

  await writeGithubJson(ACTIVITY_PATH, updatedActivity, sha, "Log deploy status activity");
}

function mapDeployStatus(state?: string | null): DeployStatus {
  if (!state) {
    return "pending";
  }

  if (state === "READY") {
    return "success";
  }

  if (state === "ERROR" || state === "CANCELED") {
    return "failed";
  }

  return "pending";
}

function shouldPersistDeployState(
  current: AgentState,
  next: {
    deployStatus: DeployStatus;
    deployStartedAt?: string;
    deployCompletedAt?: string;
    deployError?: string;
    lastDeployUrl?: string;
  },
) {
  return (
    current.deployStatus !== next.deployStatus ||
    current.deployStartedAt !== next.deployStartedAt ||
    current.deployCompletedAt !== next.deployCompletedAt ||
    current.deployError !== next.deployError ||
    current.lastDeployUrl !== next.lastDeployUrl
  );
}

async function createDeployRecoveryTask(reason: string) {
  const { json } = await readGithubJson(".agent/tasks.json", []);
  const tasks = Array.isArray(json) ? json : [];
  const candidate = tasks.find(
    (task) =>
      task &&
      !task.recoveryOfTaskId &&
      (task.result?.pullRequestUrl || task.status === "pending-pr" || task.status === "done")
  );

  if (!candidate) {
    return null;
  }

  return createRecoveryTask({
    failedTask: candidate,
    reason,
  });
}

export async function GET() {
  try {
    const token = process.env.VERCEL_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing VERCEL_TOKEN",
        },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_NAME}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    const data = await res.json();
    const deployment = data.deployments?.[0];

    if (!deployment) {
      return NextResponse.json({
        ok: true,
        deployment: null,
        deployFailed: false,
        deployStatus: "pending",
      });
    }

    const deploymentStatus = {
      id: deployment.uid,
      state: deployment.state,
      url: deployment.url,
      createdAt: deployment.createdAt,
    };

    const deployStatus = mapDeployStatus(deployment.state);
    const deployFailed = deployStatus === "failed";
    const deploySucceeded = deployStatus === "success";
    const deployStartedAt = new Date(
      deployment.createdAt ?? Date.now()
    ).toISOString();
    const deployCompletedAt =
      deployStatus === "pending"
        ? undefined
        : new Date().toISOString();
    const deployError =
      deployStatus === "failed"
        ? `Deployment failed with Vercel state ${deployment.state}`
        : undefined;

    const { json: stateJson, sha: stateSha } = await readGithubJson(
      STATE_PATH,
      {}
    );
    const currentState = (stateJson || {}) as AgentState;
    const nextState: AgentState = {
      ...currentState,
      deployStatus,
      deployStartedAt: currentState.deployStartedAt ?? deployStartedAt,
      deployCompletedAt:
        deployStatus === "pending"
          ? currentState.deployCompletedAt
          : deployCompletedAt,
      deployError,
      lastDeployUrl: deployment.url,
      recentDeployFailures: deployFailed
        ? (currentState.recentDeployFailures ?? 0) + 1
        : deploySucceeded
          ? 0
          : currentState.recentDeployFailures ?? 0,
      recoveryActive: deployFailed ? true : deploySucceeded ? false : currentState.recoveryActive,
      autoRunEnabled: deployFailed
        ? false
        : deploySucceeded && currentState.recoveryAutoRunResumeEligible
          ? true
          : currentState.autoRunEnabled,
      recoveryAutoRunResumeEligible: deployFailed
        ? currentState.autoRunEnabled === true
        : deploySucceeded
          ? false
          : currentState.recoveryAutoRunResumeEligible,
    };

    if (deployFailed && !(currentState.deployStatus === "failed" && currentState.lastDeployUrl === deployment.url)) {
      nextState.recentDeployFailures = 1;
    }

    if (shouldPersistDeployState(currentState, {
      deployStatus,
      deployStartedAt: nextState.deployStartedAt,
      deployCompletedAt: nextState.deployCompletedAt,
      deployError: nextState.deployError,
      lastDeployUrl: nextState.lastDeployUrl,
    })) {
      await writeGithubJson(
        STATE_PATH,
        nextState,
        stateSha as string,
        deployFailed
          ? "Record failed deploy status"
          : deploySucceeded
            ? "Record successful deploy status"
            : "Record pending deploy status"
      );
    }

    if (deployFailed && currentState.deployStatus !== "failed") {
      await logActivity({
        type: "deploy-failed",
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
        reason: deployError,
      });

      await recordRuntimeDeployMemory({
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
        reason: deployError,
        status: "failed",
      }).catch(() => {});

      await createDeployRecoveryTask(deployError ?? "Deployment failed").catch(() => {});

      if (currentState.overnightModeActive) {
        nextState.overnightModeActive = false;
        nextState.overnightSessionCompletedAt = new Date().toISOString();
        nextState.overnightSessionStopReason = "deploy-failed";
        nextState.overnightFailures = (currentState.overnightFailures ?? 0) + 1;
        nextState.overnightRecoveries = (currentState.overnightRecoveries ?? 0) + 1;

        await logActivity({
          type: "overnight-session-stopped",
          reason: "Deployment failed during overnight mode.",
          deploymentId: deployment.uid,
          deploymentUrl: deployment.url,
        }).catch(() => {});
      }
    }

    if (deploySucceeded && currentState.deployStatus !== "success") {
      await logActivity({
        type: "deploy-succeeded",
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
        reason: "Latest deployment reached READY",
      });

      await recordRuntimeDeployMemory({
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
        status: "success",
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      deployment: deploymentStatus,
      deployFailed,
      deployStatus,
      deployStartedAt: nextState.deployStartedAt,
      deployCompletedAt: nextState.deployCompletedAt,
      deployError: nextState.deployError,
      lastDeployUrl: nextState.lastDeployUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
