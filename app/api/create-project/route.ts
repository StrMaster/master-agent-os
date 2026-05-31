import { NextResponse } from "next/server";
import { createGithubRepo } from "@/app/lib/github-repo-creator";

export async function POST(request: Request) {
  try {
    const { projectName, projectType } = await request.json();

    if (!projectName || !projectType) {
      return NextResponse.json(
        { ok: false, error: "projectName and projectType are required" },
        { status: 400 }
      );
    }

    const result = await createGithubRepo({
      name: projectName,
      description: `AI Studio project: ${projectType}`,
      private: false,
    });

    return NextResponse.json({ ok: true, repoUrl: result.repoUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
