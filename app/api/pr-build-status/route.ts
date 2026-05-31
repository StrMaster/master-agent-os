import { NextRequest, NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";

export async function GET(req: NextRequest) {
  const branch = req.nextUrl.searchParams.get("branch");

  if (!branch) {
    return NextResponse.json({ ok: false, error: "Missing branch" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing GITHUB_TOKEN" }, { status: 500 });
  }

  try {
    // Get latest commit SHA on branch
    const commitRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits/${branch}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );

    if (!commitRes.ok) {
      return NextResponse.json({ ok: true, status: "unknown" });
    }

    const commit = await commitRes.json() as { sha: string };

    // Get check runs for that commit
    const checksRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits/${commit.sha}/check-runs`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );

    if (!checksRes.ok) {
      return NextResponse.json({ ok: true, status: "unknown" });
    }

    const checks = await checksRes.json() as { check_runs: Array<{ name: string; status: string; conclusion: string | null }> };
    const runs = checks.check_runs ?? [];

    if (runs.length === 0) {
      return NextResponse.json({ ok: true, status: "pending" });
    }

    // Determine overall status
    const anyFailed = runs.some((r) => r.conclusion === "failure" || r.conclusion === "cancelled");
    const allSuccess = runs.every((r) => r.conclusion === "success");
    const anyPending = runs.some((r) => r.status === "in_progress" || r.status === "queued");

    const status = anyFailed ? "failure" : allSuccess ? "success" : anyPending ? "pending" : "unknown";

    return NextResponse.json({ ok: true, status, runs: runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })) });
  } catch {
    return NextResponse.json({ ok: true, status: "unknown" });
  }
}
