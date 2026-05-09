import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const STATE_PATH = ".agent/state.json";

type ControlState = {
  paused?: boolean;
  runnerLocked?: boolean;
  runnerLockStartedAt?: number;
  lastRunAt?: number;
  autoRunEnabled?: boolean;
  autoMergeEnabled?: boolean;
  emergencyStop?: boolean;
};

type GitHubFile = {
  sha: string;
  content: string;
};

async function readStateFile() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${STATE_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${STATE_PATH}: ${res.status}`);
  }

  const file = (await res.json()) as GitHubFile;
  const content = Buffer.from(file.content, "base64").toString("utf-8");

  return {
    state: JSON.parse(content) as ControlState,
    sha: file.sha,
  };
}

async function writeStateFile(
  state: ControlState,
  sha: string,
  message: string,
) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const content = Buffer.from(JSON.stringify(state, null, 2) + "\n").toString(
    "base64",
  );

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${STATE_PATH}`,
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
    throw new Error(`Failed to write ${STATE_PATH}: ${res.status} ${text}`);
  }
}

export async function GET() {
  try {
    const { state } = await readStateFile();

    return NextResponse.json({
      ok: true,
      state: {
        paused: state.paused ?? false,
        runnerLocked: state.runnerLocked ?? false,
        runnerLockStartedAt: state.runnerLockStartedAt,
        lastRunAt: state.lastRunAt,
        autoRunEnabled: state.autoRunEnabled ?? false,
        autoMergeEnabled: state.autoMergeEnabled ?? false,
        emergencyStop: state.emergencyStop ?? false,
      },
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { state, sha } = await readStateFile();

    const nextState: ControlState = {
      ...state,
    };

    if (typeof body.paused === "boolean") {
      nextState.paused = body.paused;
    }

    if (typeof body.autoRunEnabled === "boolean") {
      nextState.autoRunEnabled = body.autoRunEnabled;
    }

    if (typeof body.autoMergeEnabled === "boolean") {
      nextState.autoMergeEnabled = body.autoMergeEnabled;
    }

    if (typeof body.emergencyStop === "boolean") {
      nextState.emergencyStop = body.emergencyStop;
    }

    await writeStateFile(nextState, sha, "Update Master Agent control state");

    return NextResponse.json({
      ok: true,
      state: nextState,
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