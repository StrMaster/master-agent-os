const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const ACTIVITY_PATH = ".agent/activity.json";

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

export async function readActivityFile() {
  const { json, sha } = await readGithubJson(ACTIVITY_PATH);

  return {
    activity: Array.isArray(json) ? json : [],
    sha,
  };
}

export async function logActivity(event: Record<string, unknown>) {
  const { activity, sha } = await readActivityFile();

  const updatedActivity = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...activity,
  ].slice(0, 150);

  await writeGithubJson(
    ACTIVITY_PATH,
    updatedActivity,
    sha,
    "Log agent activity"
  );
}
