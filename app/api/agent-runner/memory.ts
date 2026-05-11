import { logActivity } from "./activity";
import { readGithubJson, writeGithubJson } from "./github";
import type { AgentState } from "./types";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const RUNTIME_MEMORY_PATH = ".agent/memory.json";
const MAX_MEMORY_ITEMS = 25;

type GitHubFile = {
  sha: string;
  content: string;
};

export type RuntimeMemory = {
  lastRun?: string | null;
  lastTaskId?: string | null;
  lastBranch?: string | null;
  lastFailure?: string | null;
  failedTasks?: Array<{
    taskId: string;
    title?: string;
    targetFile?: string;
    reason?: string;
    at: string;
    runId?: string;
  }>;
  recoveryHistory?: Array<{
    taskId: string;
    recoveryTaskId?: string;
    reason?: string;
    status:
      | "created"
      | "duplicate-blocked"
      | "retry-started"
      | "retry-blocked"
      | "retry-completed";
    at: string;
  }>;
  deployFailures?: Array<{
    deploymentId?: string;
    deploymentUrl?: string;
    reason?: string;
    at: string;
  }>;
  riskyFiles?: Array<{
    targetFile: string;
    hits: number;
    lastSeenAt: string;
    lastTaskId?: string;
    lastReason?: string;
  }>;
  executionSummaries?: Array<{
    taskId: string;
    title?: string;
    targetFile?: string;
    status: string;
    branchName?: string;
    pullRequestUrl?: string;
    completedAt: string;
  }>;
  updatedAt?: string;
};

type RuntimeMemoryRiskyFile = NonNullable<RuntimeMemory["riskyFiles"]>[number];

function pruneRuntimeMemory(memory: RuntimeMemory): RuntimeMemory {
  const riskyFiles = Array.isArray(memory.riskyFiles) ? memory.riskyFiles : [];
  const riskyByTarget = new Map<string, RuntimeMemoryRiskyFile>();

  for (const entry of riskyFiles) {
    if (!entry?.targetFile) {
      continue;
    }

    const current = riskyByTarget.get(entry.targetFile);
    if (!current) {
      riskyByTarget.set(entry.targetFile, entry);
      continue;
    }

    if ((current.lastSeenAt ?? "") <= (entry.lastSeenAt ?? "")) {
      riskyByTarget.set(entry.targetFile, {
        ...entry,
        hits: Math.max(current.hits ?? 0, entry.hits ?? 0),
      });
    }
  }

  return {
    ...memory,
    failedTasks: (memory.failedTasks ?? []).slice(0, MAX_MEMORY_ITEMS),
    recoveryHistory: (memory.recoveryHistory ?? []).slice(0, MAX_MEMORY_ITEMS),
    deployFailures: (memory.deployFailures ?? []).slice(0, MAX_MEMORY_ITEMS),
    riskyFiles: [...riskyByTarget.values()]
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
      .slice(0, MAX_MEMORY_ITEMS),
    executionSummaries: (memory.executionSummaries ?? []).slice(0, MAX_MEMORY_ITEMS),
    updatedAt: new Date().toISOString(),
  };
}

async function readGithubJsonOrDefault(path: string, fallback: unknown) {
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
    }
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

export async function readRuntimeMemoryFile() {
  const { json, sha } = await readGithubJsonOrDefault(RUNTIME_MEMORY_PATH, {});

  return {
    memory: pruneRuntimeMemory(json || {}),
    sha,
  };
}

export async function writeRuntimeMemoryFile(
  memory: RuntimeMemory,
  sha: string | null,
  message: string
) {
  if (!sha) {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error("Missing GITHUB_TOKEN");
    }

    const content = Buffer.from(JSON.stringify(memory, null, 2) + "\n").toString(
      "base64"
    );

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${RUNTIME_MEMORY_PATH}`,
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
          branch: BRANCH,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to write ${RUNTIME_MEMORY_PATH}: ${res.status} ${text}`
      );
    }

    return;
  }

  await writeGithubJson(RUNTIME_MEMORY_PATH, memory, sha, message);
}

export async function updateRuntimeMemoryWith(
  mutator: (memory: RuntimeMemory) => RuntimeMemory,
  message: string,
  activity?: Record<string, unknown>
) {
  const { memory, sha } = await readRuntimeMemoryFile();
  const nextMemory = pruneRuntimeMemory(mutator(memory));

  await writeRuntimeMemoryFile(nextMemory, sha, message);

  if (activity) {
    await logActivity({
      type: "runtime-memory-updated",
      reason: message,
      ...activity,
    }).catch(() => {});
  }

  return nextMemory;
}

export async function recordRuntimeFailureMemory(input: {
  taskId: string;
  title?: string;
  targetFile?: string;
  reason?: string;
  runId?: string;
}) {
  const at = new Date().toISOString();

  return updateRuntimeMemoryWith(
    (memory) => ({
      ...memory,
      lastFailure: input.reason ?? memory.lastFailure ?? null,
      lastTaskId: input.taskId,
      lastRun: at,
      failedTasks: [
        {
          taskId: input.taskId,
          title: input.title,
          targetFile: input.targetFile,
          reason: input.reason,
          at,
          runId: input.runId,
        },
        ...(memory.failedTasks ?? []),
      ],
      riskyFiles: input.targetFile
        ? [
            {
              targetFile: input.targetFile,
              hits:
                ((memory.riskyFiles ?? []).find(
                  (entry) => entry.targetFile === input.targetFile
                )?.hits ?? 0) + 1,
              lastSeenAt: at,
              lastTaskId: input.taskId,
              lastReason: input.reason,
            },
            ...((memory.riskyFiles ?? []).filter(
              (entry) => entry.targetFile !== input.targetFile
            ) as NonNullable<RuntimeMemory["riskyFiles"]>),
          ]
        : memory.riskyFiles,
    }),
    "Track failed task in runtime memory",
    {
      taskId: input.taskId,
      targetFile: input.targetFile,
      runId: input.runId,
    }
  );
}

export async function recordRuntimeRecoveryMemory(input: {
  taskId: string;
  recoveryTaskId?: string;
  reason?: string;
  status:
    | "created"
    | "duplicate-blocked"
    | "retry-started"
    | "retry-blocked"
    | "retry-completed";
}) {
  const at = new Date().toISOString();

  return updateRuntimeMemoryWith(
    (memory) => ({
      ...memory,
      recoveryHistory: [
        {
          taskId: input.taskId,
          recoveryTaskId: input.recoveryTaskId,
          reason: input.reason,
          status: input.status,
          at,
        },
        ...(memory.recoveryHistory ?? []),
      ],
    }),
    "Track recovery history in runtime memory",
    {
      taskId: input.taskId,
      recoveryTaskId: input.recoveryTaskId,
      status: input.status,
    }
  );
}

export async function recordRuntimeDeployMemory(input: {
  deploymentId?: string;
  deploymentUrl?: string;
  reason?: string;
  status: "failed" | "success" | "pending";
}) {
  const at = new Date().toISOString();

  return updateRuntimeMemoryWith(
    (memory) => ({
      ...memory,
      deployFailures:
        input.status === "failed"
          ? [
              {
                deploymentId: input.deploymentId,
                deploymentUrl: input.deploymentUrl,
                reason: input.reason,
                at,
              },
              ...(memory.deployFailures ?? []),
            ]
          : input.status === "success"
            ? []
            : memory.deployFailures,
      lastBranch: input.deploymentUrl ?? memory.lastBranch ?? null,
    }),
    "Track deploy outcome in runtime memory",
    {
      deploymentId: input.deploymentId,
      deploymentUrl: input.deploymentUrl,
      status: input.status,
    }
  );
}

export async function recordRuntimeExecutionSummary(input: {
  taskId: string;
  title?: string;
  targetFile?: string;
  status: string;
  branchName?: string;
  pullRequestUrl?: string;
  completedAt?: string;
}) {
  const completedAt = input.completedAt ?? new Date().toISOString();

  return updateRuntimeMemoryWith(
    (memory) => ({
      ...memory,
      lastTaskId: input.taskId,
      lastRun: completedAt,
      lastBranch: input.branchName ?? memory.lastBranch ?? null,
      executionSummaries: [
        {
          taskId: input.taskId,
          title: input.title,
          targetFile: input.targetFile,
          status: input.status,
          branchName: input.branchName,
          pullRequestUrl: input.pullRequestUrl,
          completedAt,
        },
        ...(memory.executionSummaries ?? []),
      ],
    }),
    "Track execution summary in runtime memory",
    {
      taskId: input.taskId,
      status: input.status,
      branchName: input.branchName,
      pullRequestUrl: input.pullRequestUrl,
    }
  );
}

export type { AgentState };
