export const runtime = 'nodejs';

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER!;
const REPO = process.env.GITHUB_REPO!;

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    const { changes } = await req.json();

    const branch = `agent-${Date.now()}`;

    const base = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/main`);

    await gh(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: base.object.sha,
      }),
    });

    for (const c of changes) {
      const file = await gh(
        `/repos/${OWNER}/${REPO}/contents/${c.filePath}?ref=${branch}`
      );

      await gh(`/repos/${OWNER}/${REPO}/contents/${c.filePath}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'AI update',
          content: Buffer.from(c.content).toString('base64'),
          sha: file.sha,
          branch,
        }),
      });
    }

    const pr = await gh(`/repos/${OWNER}/${REPO}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'AI change',
        head: branch,
        base: 'main',
      }),
    });

    return Response.json({ pr: pr.html_url });
  } catch (e: any) {
    return Response.json(
      { error: e.message, buildError: e.message },
      { status: 500 }
    );
  }
}