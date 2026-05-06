import { NextResponse } from "next/server";

const OWNER = "StrMaster";
const REPO = "master-agent-os";
const BRANCH = "main";
const ACTIVITY_PATH = ".agent/activity.json";

type GitHubFile = {
  content: string;
};

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error("Missing GITHUB_TOKEN");
    }

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ACTIVITY_PATH}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to read activity.json: ${res.status}`);
    }

    const file = (await res.json()) as GitHubFile;
    const content = Buffer.from(file.content, "base64").toString("utf-8");

    return NextResponse.json({
      ok: true,
      activity: JSON.parse(content),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}