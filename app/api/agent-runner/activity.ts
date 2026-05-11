const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const ACTIVITY_PATH = ".agent/activity.json";

type GitHubFile = {
  sha: string;
  content: string;
};

type RuntimeActivityEvent = Record<string, unknown> & {
  id?: string;
  timestamp?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __MASTER_AGENT_RUNTIME_ACTIVITY__: RuntimeActivityEvent[] | undefined;
}

function getRuntimeActivityStore() {
  if (!globalThis.__MASTER_AGENT_RUNTIME_ACTIVITY__) {
    globalThis.__MASTER_AGENT_RUNTIME_ACTIVITY__ = [];
  }

  return globalThis.__MASTER_AGENT_RUNTIME_ACTIVITY__;
}

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

export async function readActivityFile() {
  const runtimeActivity = getRuntimeActivityStore();

  try {
    const { json, sha } = await readGithubJson(ACTIVITY_PATH);
    const persistedActivity = Array.isArray(json) ? json : [];

    return {
      activity: [...runtimeActivity, ...persistedActivity].slice(0, 150),
      sha,
    };
  } catch {
    return {
      activity: runtimeActivity.slice(0, 150),
      sha: null,
    };
  }
}

export async function logActivity(event: Record<string, unknown>) {
  const runtimeActivity = getRuntimeActivityStore();

  runtimeActivity.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  });

  globalThis.__MASTER_AGENT_RUNTIME_ACTIVITY__ = runtimeActivity.slice(0, 150);

  console.log("[runtime-activity]", event.type ?? "event");
}
