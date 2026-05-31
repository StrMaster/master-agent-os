import { NextRequest, NextResponse } from "next/server";
import { saveLead, getLeads, updateLeadStatus, type Lead } from "@/app/lib/leads-service";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as Lead["status"] | null;

  const leads = await getLeads(status ?? undefined);
  return NextResponse.json({ ok: true, leads });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<Lead>;

    if (!body.name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    const lead = await saveLead({
      name: body.name,
      email: body.email,
      company: body.company,
      website: body.website,
      industry: body.industry,
      status: body.status ?? "new",
      source: body.source ?? "manual",
      notes: body.notes,
      outreachCount: 0,
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: "Failed to save lead" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, notes } = await req.json() as { id: string; status: Lead["status"]; notes?: string };

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "id and status required" }, { status: 400 });
    }

    const ok = await updateLeadStatus(id, status, notes);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
