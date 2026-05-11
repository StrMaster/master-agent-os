import { NextResponse } from "next/server";

const PROJECT_NAME = "master-agent-os";

type DeployStatus = "pending" | "success" | "failed";

function mapDeployStatus(state?: string | null): DeployStatus {
  if (!state) {
    return "pending";
  }

  if (state === "READY") {
    return "success";
  }

  if (state === "ERROR" || state === "CANCELED") {
    return "failed";
  }

  return "pending";
}

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

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to read Vercel deployment status: ${res.status}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const deployment = data.deployments?.[0];

    if (!deployment) {
      return NextResponse.json({
        ok: true,
        deployment: null,
        deployFailed: false,
        deployStatus: "pending",
      });
    }

    const deployStatus = mapDeployStatus(deployment.state);
    const deployFailed = deployStatus === "failed";
    const deployStartedAt = new Date(
      deployment.createdAt ?? Date.now()
    ).toISOString();
    const deployCompletedAt =
      deployStatus === "pending" ? undefined : new Date().toISOString();
    const deployError = deployFailed
      ? `Deployment failed with Vercel state ${deployment.state}`
      : undefined;

    return NextResponse.json({
      ok: true,
      deployment: {
        id: deployment.uid,
        state: deployment.state,
        url: deployment.url,
        createdAt: deployment.createdAt,
      },
      deployFailed,
      deployStatus,
      deployStartedAt,
      deployCompletedAt,
      deployError,
      lastDeployUrl: deployment.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
