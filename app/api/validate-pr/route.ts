import {
  NextResponse,
} from "next/server";

import {
  validatePullRequest,
} from "@/app/lib/github-pr";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const result =
      await validatePullRequest(
        body.prNumber
      );

    return NextResponse.json({
      ok: true,

      validation:
        result,
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