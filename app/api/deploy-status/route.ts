import { NextResponse } from "next/server";

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
  lastDeploymentId?: string | null;
  lastDeploymentState?: string | null;
  lastDeployFailureId?: string | null;
};

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
      });
    }

    const deploymentStatus = {
      id: deployment.uid,
      state: deployment.state,
      url: deployment.url,
      createdAt: deployment.createdAt,
    };

    const deployFailed = deployment.state === "ERROR";

    return NextResponse.json({
      ok: true,
      deployment: deploymentStatus,
      deployFailed,
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