import { NextRequest, NextResponse } from "next/server";
import { sendEmail, generateOutreachEmail } from "@/app/lib/email-sender";
import { saveLead, incrementOutreachCount, getLeads } from "@/app/lib/leads-service";
import { findLeadsByNiche } from "@/app/lib/lead-scraper";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: "send" | "generate" | "find-leads";
      leadId?: string;
      email?: string;
      name?: string;
      company?: string;
      website?: string;
      observation?: string;
      niche?: string;
      location?: string;
    };

    // Generate email copy only
    if (body.action === "generate") {
      const copy = await generateOutreachEmail({
        leadName: body.name ?? "there",
        company: body.company,
        website: body.website,
        observation: body.observation,
      });
      return NextResponse.json({ ok: true, ...copy });
    }

    // Find leads by niche
    if (body.action === "find-leads") {
      if (!body.niche) {
        return NextResponse.json({ ok: false, error: "niche is required" }, { status: 400 });
      }

      const scraped = await findLeadsByNiche(body.niche, body.location);

      // Save to DB
      const saved = await Promise.all(
        scraped.map((l) =>
          saveLead({
            name: l.name,
            email: l.email,
            company: l.company,
            website: l.website,
            industry: l.industry ?? body.niche,
            status: "new",
            source: l.source,
            outreachCount: 0,
          })
        )
      );

      return NextResponse.json({ ok: true, found: scraped.length, saved: saved.filter(Boolean).length });
    }

    // Send outreach email
    if (body.action === "send") {
      if (!body.email || !body.name) {
        return NextResponse.json({ ok: false, error: "email and name required" }, { status: 400 });
      }

      // Generate personalized copy
      const copy = await generateOutreachEmail({
        leadName: body.name,
        company: body.company,
        website: body.website,
        observation: body.observation,
      });

      const result = await sendEmail({
        to: body.email,
        subject: copy.subject,
        body: copy.body,
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }

      // Update lead outreach count
      if (body.leadId) {
        await incrementOutreachCount(body.leadId);
      }

      return NextResponse.json({ ok: true, emailId: result.id, subject: copy.subject });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
