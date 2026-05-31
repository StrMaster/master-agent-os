import { logActivity } from "@/app/api/agent-runner/activity";
import { readRuntimeMemoryFile } from "@/app/api/agent-runner/memory";
import type { RuntimeMemory } from "@/app/api/agent-runner/memory";
import { writeGithubJson } from "@/app/api/agent-runner/github";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const REPO_CONTEXT_PATH = ".agent/repo-context.json";
const MAX_CONTEXT_ITEMS = 24;

type GitHubFile = {
  sha: string;
  content: string;
};

export type RepoContext = {
  activeRuntimeAreas?: string[];
  legacyZones?: string[];
  frontendFiles?: string[];
  backendFiles?: string[];
  orchestrationFiles?: string[];
  riskyFiles?: RuntimeMemory["riskyFiles"];
  allFiles?: string[];
  updatedAt?: string;
};

type GitHubTreeItem = {
  path: string;
  type: string;
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
  truncated: boolean;
};

export async function fetchRepoTree(): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as GitHubTreeResponse;
    return data.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter((path) =>
        path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".json")
      )
      .slice(0, 200);
  } catch {
    return [];
  }
}

type RepoContextFile = RepoContext;

const DEFAULT_CONTEXT: RepoContext = {
  activeRuntimeAreas: [
    "app/api/agent-runner/route.ts",
    "app/api/agent-runner/state.ts",
    "app/api/agent-runner/tasks.ts",
    "app/api/agent-runner/memory.ts",
    "app/api/auto-run/route.ts",
    "app/api/control-state/route.ts",
    "app/api/create-task/route.ts",
    "app/api/deploy-status/route.ts",
    "app/api/planner-waves/route.ts",
  ],
  legacyZones: ["app/agents/page.tsx", "/api/agent-delegate", "apply-changes", "propose-changes"],
  frontendFiles: [
    "app/page.tsx",
    "app/components/ActivityFeed.tsx",
    "app/components/RunAgentButton.tsx",
    "app/execution/page.tsx",
    "app/tasks/page.tsx",
  ],
  backendFiles: [
    "app/api/agent-runner/route.ts",
    "app/api/agent-runner/state.ts",
    "app/api/agent-runner/tasks.ts",
    "app/api/agent-runner/memory.ts",
    "app/api/auto-run/route.ts",
    "app/api/control-state/route.ts",
    "app/api/create-task/route.ts",
    "app/api/deploy-status/route.ts",
    "app/api/planner-waves/route.ts",
    "app/api/approve-preview-task/route.ts",
    "app/api/approve-planner-wave/route.ts",
  ],
  orchestrationFiles: [
    "app/api/agent-runner/route.ts",
    "app/api/agent-runner/state.ts",
    "app/api/agent-runner/tasks.ts",
    "app/api/agent-runner/memory.ts",
    "app/api/auto-run/route.ts",
    "app/api/control-state/route.ts",
    "app/api/deploy-status/route.ts",
  ],
  riskyFiles: [],
};

function mergeUnique(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function pruneRepoContext(context: RepoContext): RepoContext {
  const riskyFiles = Array.isArray(context.riskyFiles) ? context.riskyFiles : [];
  const riskyByTarget = new Map<string, NonNullable<RepoContext["riskyFiles"]>[number]>();

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
    ...context,
    activeRuntimeAreas: mergeUnique([
      ...(context.activeRuntimeAreas ?? []),
    ]).slice(0, MAX_CONTEXT_ITEMS),
    legacyZones: mergeUnique([...(context.legacyZones ?? [])]).slice(0, MAX_CONTEXT_ITEMS),
    frontendFiles: mergeUnique([...(context.frontendFiles ?? [])]).slice(0, MAX_CONTEXT_ITEMS),
    backendFiles: mergeUnique([...(context.backendFiles ?? [])]).slice(0, MAX_CONTEXT_ITEMS),
    orchestrationFiles: mergeUnique([...(context.orchestrationFiles ?? [])]).slice(0, MAX_CONTEXT_ITEMS),
    riskyFiles: [...riskyByTarget.values()]
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
      .slice(0, MAX_CONTEXT_ITEMS),
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

async function readRepoContextFile() {
  const { json, sha } = await readGithubJsonOrDefault(REPO_CONTEXT_PATH, {});

  return {
    context: pruneRepoContext({
      ...DEFAULT_CONTEXT,
      ...(json as RepoContextFile),
    }),
    sha,
  };
}

function collectObservedFiles(memory: RuntimeMemory) {
  return mergeUnique([
    ...(memory.failedTasks ?? []).map((task) => task.targetFile),
    ...(memory.executionSummaries ?? []).map((summary) => summary.targetFile),
    ...(memory.riskyFiles ?? []).map((entry) => entry.targetFile),
  ]);
}

export async function readRepoContext() {
  const [{ context }, { memory }, allFiles] = await Promise.all([
    readRepoContextFile(),
    readRuntimeMemoryFile(),
    fetchRepoTree(),
  ]);

  const observedFiles = collectObservedFiles(memory);
  const activeRuntimeAreas = mergeUnique([
    ...(context.activeRuntimeAreas ?? []),
    ...observedFiles,
  ]);

  return pruneRepoContext({
    ...context,
    activeRuntimeAreas,
    riskyFiles: memory.riskyFiles ?? context.riskyFiles ?? [],
    allFiles: allFiles.length > 0 ? allFiles : context.allFiles,
  });
}

export function getActiveFileHints(context: RepoContext) {
  return mergeUnique([
    ...(context.activeRuntimeAreas ?? []),
    ...(context.orchestrationFiles ?? []),
    ...(context.frontendFiles ?? []),
    ...(context.backendFiles ?? []),
  ]);
}

export function getLegacyFileHints(context: RepoContext) {
  return mergeUnique([...(context.legacyZones ?? [])]);
}

export async function updateRepoContext(
  mutator: (context: RepoContext) => RepoContext,
  message: string,
  activity?: Record<string, unknown>
) {
  const { context, sha } = await readRepoContextFile();
  const nextContext = pruneRepoContext(mutator(context));

  if (!sha) {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error("Missing GITHUB_TOKEN");
    }

    const content = Buffer.from(JSON.stringify(nextContext, null, 2) + "\n").toString(
      "base64"
    );

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${REPO_CONTEXT_PATH}`,
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
        `Failed to write ${REPO_CONTEXT_PATH}: ${res.status} ${text}`
      );
    }
  } else {
    await writeGithubJson(REPO_CONTEXT_PATH, nextContext, sha, message);
  }

  if (activity) {
    await logActivity({
      type: "repo-context-updated",
      reason: message,
      ...activity,
    }).catch(() => {});
  }

  return nextContext;
}
