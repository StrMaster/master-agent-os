import { NextResponse } from "next/server";
import {
  getPortfolio,
  addProduct,
  updateProduct,
  addSale,
  deleteProduct,
  getPortfolioStats,
} from "@/app/lib/portfolio-store";

export async function GET() {
  try {
    const products = await getPortfolio();
    const stats = await getPortfolioStats(products);
    return NextResponse.json({ ok: true, products, stats });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "add");

    if (action === "add") {
      const product = await addProduct({
        name: String(body.name ?? ""),
        niche: String(body.niche ?? ""),
        productType: String(body.productType ?? "digital-template"),
        status: body.status ?? "ready",
        platform: Array.isArray(body.platform) ? body.platform : ["Etsy"],
        price: Number(body.price ?? 0),
        pipelineId: body.pipelineId,
        listingUrl: body.listingUrl,
      });
      return NextResponse.json({ ok: true, product });
    }

    if (action === "update") {
      const product = await updateProduct(String(body.id), body.update ?? {});
      return NextResponse.json({ ok: true, product });
    }

    if (action === "add-sale") {
      const product = await addSale(String(body.productId), {
        date: new Date().toISOString(),
        amount: Number(body.amount ?? 0),
        platform: String(body.platform ?? "Etsy"),
      });
      return NextResponse.json({ ok: true, product });
    }

    if (action === "delete") {
      await deleteProduct(String(body.id));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
