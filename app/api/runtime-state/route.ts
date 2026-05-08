import { NextResponse }
from "next/server";

import {
  getRuntimeTasks,
} from "@/app/lib/task-runtime";

export async function GET() {
  return NextResponse.json({
    tasks:
      getRuntimeTasks(),
  });
}