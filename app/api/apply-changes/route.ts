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

function isUnifiedDiff(content: string) {
  return content.includes('@@') && content.includes('\n-') && content.includes('\n+');
}

function decodeBase64Content(content: string) {
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8');
}

function applyUnifiedDiff(original: string, diff: string) {
  const originalLines = original.split('\n');
  const result: string[] = [];
  const diffLines = diff.split('\n');

  let originalIndex = 0;
  let i = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];

    if (!line.startsWith('@@')) {
      i += 1;
      continue;
    }

    const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!match) {
      throw new Error(`Invalid diff hunk header: ${line}`);
    }

    const oldStart = Number(match[1]) - 1;

    while (originalIndex < oldStart) {
      result.push(originalLines[originalIndex]);
      originalIndex += 1;
    }

    i += 1;

    while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
      const hunkLine = diffLines[i];

      if (hunkLine.startsWith(' ')) {
        const expected = hunkLine.slice(1);
        const actual = originalLines[originalIndex];

        if (actual !== expected) {
          throw new Error(
            `Diff context mismatch. Expected "${expected}", got "${actual ?? ''}"`
          );
        }

        result.push(actual);
        originalIndex += 1;
      } else if (hunkLine.startsWith('-')) {
        const expected = hunkLine.slice(1);
        const actual = originalLines[originalIndex];

        if (actual !== expected) {
          throw new Error(
            `Diff remove mismatch. Expected "${expected}", got "${actual ?? ''}"`
          );
        }

        originalIndex += 1;
      } else if (hunkLine.startsWith('+')) {
        result.push(hunkLine.slice(1));
      } else if (hunkLine.trim() === '') {
        // ignore empty trailing diff line
      } else if (hunkLine.startsWith('\\')) {
        // "\ No newline at end of file"
      } else {
        throw new Error(`Unsupported diff line: ${hunkLine}`);
      }

      i += 1;
    }
  }

  while (originalIndex < originalLines.length) {
    result.push(originalLines[originalIndex]);
    originalIndex += 1;
  }

  return result.join('\n');
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

async function createOrGetBranch(branchName: string, baseSha: string) {
  try {
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (!message.includes('Reference already exists')) {
      throw error;
    }
  }
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
        return Response.json({ error: 'Invalid change item' }, { status: 400 });
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
    await createOrGetBranch(proposal.branchName, baseSha);

    for (const change of proposal.changes) {
      const existingFile = await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
          change.filePath
        )}?ref=${proposal.branchName}`
      );

      const existingSha = existingFile.sha;
      const originalContent = decodeBase64Content(existingFile.content);

      const nextContent = isUnifiedDiff(change.content)
        ? applyUnifiedDiff(originalContent, change.content)
        : change.content;

      await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(
          change.filePath
        )}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: proposal.commitMessage,
            content: Buffer.from(nextContent, 'utf8').toString('base64'),
            branch: proposal.branchName,
            sha: existingSha,
          }),
        }
      );
    }

    let pullRequestUrl: string | null = null;

    try {
      const prResponse = await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: proposal.commitMessage,
            head: proposal.branchName,
            base: GITHUB_DEFAULT_BRANCH,
            body: `Automated change proposal.\n\nSummary: ${proposal.summary}`,
          }),
        }
      );

      if (prResponse && prResponse.html_url) {
        pullRequestUrl = prResponse.html_url;
      }
    } catch {
      pullRequestUrl = null;
    }

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
      error: `Failed to create pull request: ${message}`,
      branchName: 'unknown',
    },
    { status: 500 }
  );
}
}
