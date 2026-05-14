import { NextResponse } from "next/server";
import { analyzeNiche, analyzeCompetitors, detectTrendingNiches } from "@/agents/business/research-agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "analyze-niche");
    const niche = String(body.niche ?? "").trim();

    if (action === "trending") {
  const niches = await detectTrendingNiches();
  return NextResponse.json({ ok: true, action, niches });
}

if (action === "detect-opportunities") {
  const { detectNicheOpportunities } = await import("@/agents/business/research-agent");
  const opportunities = await detectNicheOpportunities();
  return NextResponse.json({ ok: true, action, opportunities });
}

    if (!niche) {
      return NextResponse.json({ ok: false, error: "niche is required" }, { status: 400 });
    }

    if (action === "analyze-niche") {
      const analysis = await analyzeNiche(niche);
      return NextResponse.json({ ok: true, action, analysis });
    }

    if (action === "analyze-competitors") {
      const analysis = await analyzeCompetitors(niche);
      return NextResponse.json({ ok: true, action, analysis });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
