import { NextRequest, NextResponse } from "next/server";
import { evaluateProduct, ProductEvaluationInput } from "@/lib/product-evaluation";

export async function POST(request: NextRequest) {
  const input = (await request.json()) as Partial<ProductEvaluationInput>;
  const fields: (keyof ProductEvaluationInput)[] = ["demand", "competition", "quality", "productCost", "shippingCost", "salePrice"];
  const invalid = fields.filter((field) => typeof input[field] !== "number" || !Number.isFinite(input[field]));

  if (invalid.length > 0) {
    return NextResponse.json({ error: "invalid_input", fields: invalid }, { status: 400 });
  }

  return NextResponse.json(evaluateProduct(input as ProductEvaluationInput));
}
