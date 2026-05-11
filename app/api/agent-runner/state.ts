import type { AgentState } from "./types";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const STATE_PATH = ".agent/state.json";

type GitHubFile = {
  sha: string;
  content: string;
};

async function readGithubJson(path: string) {
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
    throw new Error(`Failed to read ${path}: ${res.status}`);
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
  message: string
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64"
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
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to write ${path}: ${res.status} ${text}`);
  }
}

export async function readStateFile() {
  const { json, sha } = await readGithubJson(STATE_PATH);

  return {
    state: (json || {}) as AgentState,
    sha,
  };
}

export async function writeStateFile(
  state: AgentState,
  sha: string,
  message: string
) {
  await writeGithubJson(STATE_PATH, state, sha, message);
}

export async function updateStateWith(
  mutator: (state: AgentState) => AgentState,
  message: string
) {
  const { state, sha } = await readStateFile();
  await writeStateFile(mutator(state), sha, message);
}

export async function incrementStateCounter(
  key:
    | "recentFailedRuns"
    | "recentValidationFailures"
    | "recentMergeFailures"
    | "recentDeployFailures",
  message: string
) {
  await updateStateWith(
    (state) => ({
      ...state,
      [key]: (state[key] ?? 0) + 1,
    }),
    message
  );
}

export async function resetRuntimeFailureCounters(message: string) {
  await updateStateWith(
    (state) => ({
      ...state,
      recentFailedRuns: 0,
      recentValidationFailures: 0,
      recentMergeFailures: 0,
      recentDeployFailures: 0,
    }),
    message
  );
}

export async function releaseRunnerLock() {
  try {
    const { state, sha } = await readStateFile();

    await writeStateFile(
      {
        ...state,
        runnerLocked: false,
        runnerLockStartedAt: undefined,
      },
      sha,
      "Release agent runner lock"
    );
  } catch {
    // Do not throw from cleanup.
  }
}
