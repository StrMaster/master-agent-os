import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const TASKS_PATH = ".agent/tasks.json";

const AUTO_RUN_COOLDOWN_MS = 30 * 60 * 1000;

let lastAutoRunAt: number | null = null;

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text.slice(0, 300),
    };
  }
}

async function readTasks() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${TASKS_PATH}?ref=${BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${TASKS_PATH}`);
  }

  const file = await res.json();

  const content = Buffer.from(
    file.content,
    "base64"
  ).toString("utf-8");

  return JSON.parse(content);
}

export async function POST() {
  try {
    const stateRes = await fetch(`${BASE_URL}/api/control-state`, {
      cache: "no-store",
    });

    const stateData = await readJsonResponse(stateRes);
    const state = stateData.state;

    if (!stateData.ok || !state) {
      return NextResponse.json({
        ok: false,
        mode: "control-state-error",
        error: stateData.error ?? "Failed to load control state",
      });
    }

    if (state.emergencyStop) {
      return NextResponse.json({
        ok: false,
        mode: "emergency-stop",
        message: "Emergency stop is active",
      });
    }

    if (state.paused) {
      return NextResponse.json({
        ok: false,
        mode: "paused",
        message: "Agent is paused",
      });
    }

    if (state.recoveryActive) {
      return NextResponse.json({
        ok: false,
        mode: "recovery-active",
        message: "Recovery mode is active",
      });
    }

    if (!state.autoRunEnabled) {
      return NextResponse.json({
        ok: false,
        mode: "auto-run-disabled",
        message: "Auto-run is disabled",
      });
    }

    const tasks = await readTasks();

const availableTask = Array.isArray(tasks)
  ? tasks.find(
      (task) =>
        task &&
        (task.status === "todo" ||
          task.status === "queued")
    )
  : null;

if (!availableTask) {
  return NextResponse.json({
    ok: true,
    mode: "no-work",
    message: "No queued or todo tasks available",
  });
}

const now = Date.now();

if (
  lastAutoRunAt &&
  now - lastAutoRunAt < AUTO_RUN_COOLDOWN_MS
) {
  return NextResponse.json({
    ok: false,
    mode: "auto-run-cooldown",
    message: "Auto-run cooldown active",
    retryAfterMs: AUTO_RUN_COOLDOWN_MS - (now - lastAutoRunAt),
  });
}

lastAutoRunAt = now;

const deployRes = await fetch(`${BASE_URL}/api/deploy-status`, {
  cache: "no-store",
});

const deployData = await readJsonResponse(deployRes);

if (!deployRes.ok || deployData.ok === false) {
  return NextResponse.json({
    ok: false,
    mode: "deploy-status-unavailable",
    message: "Deploy status unavailable. Auto-run blocked for safety.",
    error: deployData.error,
  });
}

const deployState = deployData.deployment?.state;

if (deployState === "BUILDING" || deployState === "QUEUED") {
  return NextResponse.json({
    ok: false,
    mode: "deploy-in-progress",
    message: "Deploy is still in progress. Auto-run blocked.",
    deployment: deployData.deployment,
  });
}

if (deployData.deployFailed || deployState === "ERROR") {
  return NextResponse.json({
    ok: false,
    mode: "deploy-failed",
    message: "Latest deploy failed. Auto-run blocked.",
    deployment: deployData.deployment,
  });
}

    const runnerRes = await fetch(`${BASE_URL}/api/agent-runner`, {
      method: "POST",
      cache: "no-store",
    });

    const runnerData = await readJsonResponse(runnerRes);

    return NextResponse.json({
      ok: runnerRes.ok && runnerData.ok !== false,
      mode: "auto-run",
      runner: runnerData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "auto-run-failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}