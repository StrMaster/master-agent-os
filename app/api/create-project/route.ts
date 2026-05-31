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

    const repoUrl = await createGithubRepo(projectName, projectType);

    return NextResponse.json({ ok: true, repoUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
