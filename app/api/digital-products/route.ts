import { NextResponse } from "next/server";
import { createDigitalProduct, type DigitalProductType } from "@/app/lib/digital-product-generator";
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

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt is required" }, { status: 400 });
    }

    const product = await createDigitalProduct({ type, prompt, style });

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
