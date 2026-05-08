import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message = String(body.message ?? "").trim();

    if (!message) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing message",
        },
        { status: 400 }
      );
    }

    const normalizedMessage =
      message.toLowerCase();

    let response =
      "Understood. I am analyzing your request.";

    let suggestedAction = "none";

    if (
      normalizedMessage.includes("dashboard")
    ) {
      response =
        "I detected a dashboard-related request. This likely affects app/page.tsx.";

      suggestedAction = "create-task";
    }

    if (
      normalizedMessage.includes("activity")
    ) {
      response =
        "I detected an activity feed related request. This likely affects ActivityFeed.tsx.";

      suggestedAction = "create-task";
    }

    if (
      normalizedMessage.includes("fix") ||
      normalizedMessage.includes("improve") ||
      normalizedMessage.includes("cleanup")
    ) {
      response +=
        " I recommend creating an execution task.";

      suggestedAction = "create-task";
    }

    return NextResponse.json({
      ok: true,
      mode: "conversation",
      response,
      suggestedAction,
      originalMessage: message,
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