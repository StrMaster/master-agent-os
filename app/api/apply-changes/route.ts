export const runtime = 'nodejs';

const GITHUB_OWNER = process.env.GITHUB_OWNER!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

async function githubFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error: ${res.status}\n${text}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { branchName, commitMessage, changes } = body;

    if (!branchName || !changes?.length) {
      return Response.json(
        { error: 'Invalid proposal payload' },
        { status: 400 }
      );
    }

    // 1. Get base branch SHA
    const baseRef = await githubFetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${DEFAULT_BRANCH}`
    );

    const baseSha = baseRef.object.sha;

    // 2. Create new branch
    const newBranch = branchName;

    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha: baseSha,
        }),
      }
    ).catch(() => {
      // branch might already exist — ignore
    });

    // 3. Apply file changes
    for (const change of changes) {
      const { filePath, content } = change;

      // get current file SHA
      const fileData = await githubFetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${DEFAULT_BRANCH}`
      );

      const fileSha = fileData.sha;

      await githubFetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage || 'update file',
            content: Buffer.from(content).toString('base64'),
            sha: fileSha,
            branch: newBranch,
          }),
        }
      );
    }

    // 4. Create PR
    const pr = await githubFetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: commitMessage || 'Update file',
          head: newBranch,
          base: DEFAULT_BRANCH,
        }),
      }
    );

    return Response.json({
      ok: true,
      branchName: newBranch,
      pullRequestUrl: pr.html_url,
      compareUrl: pr.html_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}