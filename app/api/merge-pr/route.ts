import { NextResponse } from "next/server";

import {
  validatePullRequest,
  mergePullRequest,
} from "@/app/lib/github-pr";

function parsePrNumberFromUrl(url: unknown) {
  if (typeof url !== "string") {
    return null;
  }

  const match = url.match(/\/pull\/(\d+)/);
  const parsed = match?.[1] ? Number(match[1]) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const prNumberFromBody = Number(body.prNumber);
    const prNumberFromUrl = parsePrNumberFromUrl(body.pullRequestUrl);
    const prNumber =
      Number.isInteger(prNumberFromBody) && prNumberFromBody > 0
        ? prNumberFromBody
        : prNumberFromUrl;

    const confirmMerge = body.confirmMerge === true;
    const taskId = typeof body.taskId === "string" ? body.taskId : undefined;

    if (!prNumber) {
      return NextResponse.json(
        {
          ok: false,
          mode: "merge-blocked",
          error: "Valid prNumber or pullRequestUrl is required",
          taskId,
        },
        { status: 400 }
      );
    }

    if (!confirmMerge) {
      return NextResponse.json(
        {
          ok: false,
          mode: "merge-confirmation-required",
          error: "Manual merge confirmation is required",
          taskId,
        },
        { status: 400 }
      );
    }

    const validation = await validatePullRequest(prNumber);

    if (
      !validation.mergeable ||
      validation.draft ||
      validation.merged ||
      validation.state !== "open"
    ) {
      return NextResponse.json(
        {
          ok: false,
          mode: "merge-blocked",
          validation,
          taskId,
        },
        { status: 400 }
      );
    }

    const mergeResult = await mergePullRequest(prNumber);

    return NextResponse.json({
      ok: true,
      mergeResult,
      taskId,
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
