import { NextResponse } from "next/server";

const PROJECT_NAME = "master-agent-os";

export async function GET() {
  try {
    const token = process.env.VERCEL_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing VERCEL_TOKEN",
        },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_NAME}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await res.json();

    const deployment =
      data.deployments?.[0];

    if (!deployment) {
      return NextResponse.json({
        ok: true,
        deployment: null,
      });
    }

    const deploymentStatus = {
  id: deployment.uid,
  state: deployment.state,
  url: deployment.url,
  createdAt: deployment.createdAt,
};

return NextResponse.json({
  ok: true,
  deployment: deploymentStatus,
  deployFailed: deployment.state === "ERROR",
});

  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}