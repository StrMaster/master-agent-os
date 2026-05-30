import { NextResponse } from "next/server";
import { createGithubRepo, scaffoldNextjsProject } from "@/app/lib/github-repo-creator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().toLowerCase().replace(/\s+/g, "-");
    const description = String(body.description ?? "").trim();
    const isPrivate = Boolean(body.private ?? false);

    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    const repo = await createGithubRepo({
      name,
      description,
      private: isPrivate,
    });

    await scaffoldNextjsProject({
      owner: repo.owner,
      repo: repo.repoName,
      projectName: name,
      description,
    });

    return NextResponse.json({
      ok: true,
      repo: {
        name: repo.repoName,
        url: repo.repoUrl,
        owner: repo.owner,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
