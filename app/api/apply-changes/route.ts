import { ChangeProposal } from '@/lib/github-types';

export const runtime = 'nodejs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';
const AUTO_MERGE_ENABLED = process.env.AUTO_MERGE_ENABLED === 'true';

async function githubRequest(path: string, init?: RequestInit) {
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

function isAllowedFile(filePath: string) {
  return (
    (filePath.startsWith('app/') ||
      filePath.startsWith('lib/') ||
      filePath.startsWith('components/')) &&
    !filePath.includes('..') &&
    !filePath.startsWith('.env') &&
    !filePath.includes('node_modules')
  );
}

async function createBranch(branchName: string) {
  const baseRef = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`
  );

  try {
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      }),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (!msg.includes('Reference already exists')) throw error;
  }
}

async function createPullRequest(proposal: ChangeProposal) {
  const prRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: proposal.commitMessage,
        head: `${GITHUB_OWNER}:${proposal.branchName}`,
        base: GITHUB_DEFAULT_BRANCH,
        body: `Automated change proposal.\n\nSummary: ${proposal.summary}`,
      }),
    }
  );

  const prData = await prRes.json();

  if (prRes.ok && prData.html_url) {
    return prData.html_url as string;
  }

  const listRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?head=${GITHUB_OWNER}:${proposal.branchName}&base=${GITHUB_DEFAULT_BRANCH}&state=open`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  const listData = await listRes.json();

  if (listRes.ok && Array.isArray(listData) && listData[0]?.html_url) {
    return listData[0].html_url as string;
  }

  throw new Error(`Failed to create PR: ${JSON.stringify(prData)}`);
}

async function autoMergeIfAllowed(proposal: ChangeProposal, pullRequestUrl: string) {
  if (!AUTO_MERGE_ENABLED) return;

  const isSafe = (proposal as any).isSafe === true;
  const changedLines = Number((proposal as any).changedLines ?? 9999);

  if (!isSafe || changedLines > 30) return;

  const match = pullRequestUrl.match(/\/pull\/(\d+)/);
  const prNumber = match?.[1];

  if (!prNumber) return;

  const mergeRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/merge`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merge_method: 'squash',
        commit_title: proposal.commitMessage,
      }),
    }
  );

  if (!mergeRes.ok) {
    const text = await mergeRes.text();
    console.error('Auto merge failed:', text);
  }
}

export async function POST(req: Request) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      throw new Error('Missing GitHub environment variables');
    }

    const proposal = (await req.json()) as ChangeProposal;

    if (
      !proposal ||
      typeof proposal.branchName !== 'string' ||
      typeof proposal.commitMessage !== 'string' ||
      !Array.isArray(proposal.changes)
    ) {
      return Response.json({ error: 'Invalid proposal' }, { status: 400 });
    }

    for (const change of proposal.changes) {
      if (!isAllowedFile(change.filePath)) {
        return Response.json(
          { error: `Blocked file path: ${change.filePath}` },
          { status: 400 }
        );
      }
    }

    await createBranch(proposal.branchName);

    for (const change of proposal.changes) {
      const fileData = await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
          change.filePath
        )}?ref=${proposal.branchName}`
      );

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
            sha: fileData.sha,
          }),
        }
      );
    }

    const pullRequestUrl = await createPullRequest(proposal);

    await autoMergeIfAllowed(proposal, pullRequestUrl);

    return Response.json({
      ok: true,
      branchName: proposal.branchName,
      repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${proposal.branchName}`,
      compareUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/compare/${GITHUB_DEFAULT_BRANCH}...${proposal.branchName}`,
      pullRequestUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return Response.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}