import { NextResponse } from "next/server";
import { nicheProfile } from "@/lib/niche-profile";

export async function GET() {
  return NextResponse.json(nicheProfile);
}
