import { NextResponse } from "next/server";
import { calculateProductPricing, analyzeMarketPricing } from "@/agents/business/pricing-engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "calculate");

    if (action === "market") {
      const niche = String(body.niche ?? "").trim();
      if (!niche) return NextResponse.json({ ok: false, error: "niche required" }, { status: 400 });
      const analysis = await analyzeMarketPricing(niche);
      return NextResponse.json({ ok: true, analysis });
    }

    if (action === "calculate") {
      const productName = String(body.productName ?? "").trim();
      const productType = String(body.productType ?? "saas-tool").trim();
      const targetMarket = String(body.targetMarket ?? "small business").trim();
      const competitorPrices = Array.isArray(body.competitorPrices)
        ? body.competitorPrices.map(Number).filter(Boolean)
        : undefined;
      const estimatedMonthlyTasks = body.estimatedMonthlyTasks
        ? Number(body.estimatedMonthlyTasks)
        : undefined;

      if (!productName) return NextResponse.json({ ok: false, error: "productName required" }, { status: 400 });

      const result = await calculateProductPricing({
        productName,
        productType,
        targetMarket,
        competitorPrices,
        estimatedMonthlyTasks,
      });

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
