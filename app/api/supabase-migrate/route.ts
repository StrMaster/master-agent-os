import { NextRequest, NextResponse } from "next/server";

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    const { tableName, sql, reason } = await req.json() as {
      tableName: string;
      sql: string;
      reason?: string;
    };

    if (!tableName || !sql) {
      return NextResponse.json({ ok: false, error: "tableName and sql required" }, { status: 400 });
    }

    if (!SUPABASE_PROJECT_ID || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "Missing SUPABASE_PROJECT_ID or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    // Use Supabase Management API to run SQL
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!res.ok) {
      const err = await res.json() as { message?: string };
      return NextResponse.json({ ok: false, error: err.message ?? "Migration failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      tableName,
      reason: reason ?? "Created by Master Agent",
      message: `Table "${tableName}" created successfully`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
