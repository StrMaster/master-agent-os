import { NextResponse } from "next/server";
import { getProductHunterReadiness } from "@/lib/product-hunter";

export async function GET() {
  return NextResponse.json(getProductHunterReadiness());
}
