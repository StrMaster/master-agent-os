import { NextResponse } from "next/server";
import { createDigitalProduct, type DigitalProductType } from "@/app/lib/digital-product-generator";
import { generateFromTemplate } from "@/app/lib/product-template-engine";
import { Redis } from "@upstash/redis";

const PRODUCTS_KEY = "master-agent-os:digital-products";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Redis env vars");
  return new Redis({ url, token });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const type = String(body.type ?? "cv-template") as DigitalProductType;
    const prompt = String(body.prompt ?? "").trim();
    const style = body.style ? String(body.style) : undefined;
    const action = String(body.action ?? "");

    if (action === "delete") {
  const id = String(body.id ?? "");
  const redis = getRedis();
  const existing = await redis.get<unknown[]>(PRODUCTS_KEY) ?? [];
  const filtered = existing.filter((p: any) => p.id !== id);
  await redis.set(PRODUCTS_KEY, filtered);
  return NextResponse.json({ ok: true });
}
    
    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
    }

    const useTemplate = ["habit-tracker"].includes(type);
let htmlContent: string;
let productData: unknown = null;

if (useTemplate) {
  const result = await generateFromTemplate({ type, prompt, style });
  htmlContent = result.html;
  productData = result.data;
} else {
  const result = await createDigitalProduct({ type, prompt, style });
  htmlContent = result.htmlContent;
}

const { generateEtsyListing } = await import("@/app/lib/digital-product-generator");
const listing = await generateEtsyListing({
  type,
  title: prompt,
  description: `Professional ${type} digital download`,
});

const product = {
  id: `product-${Date.now()}`,
  type,
  title: listing.title,
  description: listing.description,
  htmlContent,
  etysListing: listing,
  templateData: productData,
  createdAt: new Date().toISOString(),
};

    const redis = getRedis();
    const existing = await redis.get<typeof product[]>(PRODUCTS_KEY) ?? [];
    await redis.set(PRODUCTS_KEY, [product, ...existing].slice(0, 50));

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const redis = getRedis();
    const products = await redis.get(PRODUCTS_KEY) ?? [];
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
