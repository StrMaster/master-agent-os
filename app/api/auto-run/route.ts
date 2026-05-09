import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export async function POST() {
  try {
    const stateRes = await fetch(`${BASE_URL}/api/control-state`, {
      cache: "no-store",
    });

    const stateData = await stateRes.json();
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

    const runnerRes = await fetch(`${BASE_URL}/api/agent-runner`, {
      method: "POST",
      cache: "no-store",
    });

    const runnerData = await runnerRes.json();

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