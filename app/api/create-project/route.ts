import { NextResponse } from "next/server";
import { createGitHubRepo } from "@/app/lib/github-repo-creator";

export async function POST(request: Request) {
  try {
    const { projectName, projectType } = await request.json();

    if (!projectName || !projectType) {
      return NextResponse.json(
        { ok: false, error: "projectName and projectType are required" },
        { status: 400 }
      );
    }

    const repoUrl = await createGitHubRepo(projectName, projectType);

    return NextResponse.json({ ok: true, repoUrl });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
