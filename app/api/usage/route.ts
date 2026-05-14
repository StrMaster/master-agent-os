import { NextResponse } from "next/server";
import { getTodayUsage } from "@/app/lib/model-router";

export async function GET() {
  try {
    const usage = await getTodayUsage();
    return NextResponse.json({ ok: true, usage: usage ?? { date: new Date().toISOString().slice(0, 10), inputTokens: 0, outputTokens: 0, costUsd: 0, callCount: 0 } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
