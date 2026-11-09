import { NextResponse } from "next/server";
import { agentToolsets, connections } from "@/lib/agent-system";

export async function GET() {
  return NextResponse.json({
    version: 1,
    connections,
    agentToolsets,
    rules: {
      humanApprovalRequiredFor: ["spend", "refund", "supplier order", "store launch", "campaign launch"],
      credentialsStoredInCode: false,
    },
  });
}
