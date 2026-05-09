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

  const prNumber = Number(body.prNumber);
const confirmMerge = body.confirmMerge === true;

if (!Number.isInteger(prNumber) || prNumber <= 0) {
  return NextResponse.json(
    {
      ok: false,
      mode: "merge-blocked",
      error: "Valid prNumber is required",
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
    },
    { status: 400 }
  );
}

    const validation =
      await validatePullRequest(
  prNumber
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
  prNumber
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