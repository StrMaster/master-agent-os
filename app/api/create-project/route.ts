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

    let vercelProject = null;
let deployment = null;

try {
  const { createVercelProject, triggerVercelDeploy } = await import("@/app/lib/vercel-deployer");

  vercelProject = await createVercelProject({
    name: repo.repoName,
    githubOwner: repo.owner,
    githubRepo: repo.repoName,
  });

  deployment = await triggerVercelDeploy({
    projectId: vercelProject.id,
    githubOwner: repo.owner,
    githubRepo: repo.repoName,
  });
} catch (deployError) {
  console.warn("[create-project] Vercel deploy failed", deployError);
}

return NextResponse.json({
  ok: true,
  repo: {
    name: repo.repoName,
    url: repo.repoUrl,
    owner: repo.owner,
  },
  vercel: vercelProject ? {
    projectUrl: vercelProject.url,
    deploymentId: deployment?.id,
    deploymentState: deployment?.state,
  } : null,
});

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
