const OWNER = "StrMaster";

const REPO =
  "master-agent-os";

const DEFAULT_BRANCH =
  "main";

export async function updateGithubFile(
  path: string,

  content: string,

  message: string,

  branch = "main"
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN"
    );
  }

  const existingRes =
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${branch || DEFAULT_BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",
        },

        cache: "no-store",
      }
    );

  // If file does not exist on branch yet, create it (new file)
  const existingSha = existingRes.ok
    ? ((await existingRes.json()) as { sha: string }).sha
    : undefined;

  const existing = { sha: existingSha };

  const updateRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,

    {
      method: "PUT",

      headers: {
        Authorization: `Bearer ${token}`,

        Accept:
          "application/vnd.github+json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        message,

        content: Buffer.from(
          content
        ).toString("base64"),

        ...(existing.sha ? { sha: existing.sha } : {}),

        branch: branch || DEFAULT_BRANCH,
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error(
      `Failed to update ${path}`
    );
  }

  return updateRes.json();
}