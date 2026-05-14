import { NextResponse } from "next/server";
import { scanObservabilitySignals } from "@/agents/core/observability";

export async function GET() {
  try {
    const result = await scanObservabilitySignals();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
