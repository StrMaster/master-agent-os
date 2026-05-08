import {
  NextResponse,
} from "next/server";

import {
  validatePullRequest,

  mergePullRequest,
} from "@/app/lib/github-pr";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const validation =
      await validatePullRequest(
        body.prNumber
      );

    if (
      !validation.mergeable ||
      validation.draft ||
      validation.merged ||
      validation.state !==
        "open"
    ) {
      return NextResponse.json(
        {
          ok: false,

          mode:
            "merge-blocked",

          validation,
        },

        { status: 400 }
      );
    }

    const mergeResult =
      await mergePullRequest(
        body.prNumber
      );

    return NextResponse.json({
      ok: true,

      mergeResult,
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