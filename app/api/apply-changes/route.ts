import { ChangeProposal } from '@/lib/github-types';

export const runtime = 'nodejs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

function assertEnv() {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Missing GitHub environment variables');
  }
}

function isAllowedFile(filePath: string) {
  return (
    (filePath.startsWith('app/') ||
      filePath.startsWith('lib/') ||
      filePath.startsWith('components/')) &&
    !filePath.includes('..') &&
    !filePath.startsWith('.env') &&
    !filePath.includes('node_modules') &&
    !filePath.includes('package-lock') &&
    !filePath.includes('vercel')
  );
}

async function githubRequest(path: string, init?: RequestInit) {
  assertEnv();

  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const proposal = body as ChangeProposal;

    if (
      !proposal ||
      typeof proposal.branchName !== 'string' ||
      typeof proposal.commitMessage !== 'string' ||
      !Array.isArray(proposal.changes)
    ) {
      return Response.json({ error: 'Invalid proposal' }, { status: 400 });
    }

    for (const change of proposal.changes) {
      if (
        !change ||
        typeof change.filePath !== 'string' ||
        typeof change.content !== 'string'
      ) {
        return Response.json(
          { error: 'Invalid change item' },
          { status: 400 }
        );
      }

      if (!isAllowedFile(change.filePath)) {
        return Response.json(
          { error: `Blocked file path: ${change.filePath}` },
          { status: 400 }
        );
      }
    }

    const branchRef = await githubRequest(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`
    );

    const baseSha = branchRef.object.sha;

    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${proposal.branchName}`,
        sha: baseSha,
      }),
    });

    for (const change of proposal.changes) {
      let existingSha: string | undefined;

      try {
        const existingFile = await githubRequest(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
            change.filePath
          )}?ref=${proposal.branchName}`
        );

        existingSha = existingFile.sha;
      } catch {
        existingSha = undefined;
      }

      await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
          change.filePath
        )}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: proposal.commitMessage,
            content: Buffer.from(change.content, 'utf8').toString('base64'),
            branch: proposal.branchName,
            sha: existingSha,
          }),
        }
      );
    }

    return Response.json({
      ok: true,
      branchName: proposal.branchName,
      repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${proposal.branchName}`,
      compareUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/compare/${GITHUB_DEFAULT_BRANCH}...${proposal.branchName}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';

    return Response.json({ error: message }, { status: 500 });
  }
}