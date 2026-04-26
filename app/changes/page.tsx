'use client';

import { useMemo, useState } from 'react';
import { ChangeProposal } from '@/lib/github-types';

type ProposalSafety = {
  isSafe: boolean;
  reasons: string[];
};

function isLikelyFullFile(content: string): boolean {
  const fullFileMarkers = [
    "'use client'",
    '"use client"',
    'export default function',
    'import ',
    'export async function',
  ];

  return content.length > 1500 && fullFileMarkers.some((marker) => content.includes(marker));
}


function countChangedLines(before: string, after: string): number {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  let changed = 0;
  const max = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < max; i += 1) {
    if (beforeLines[i] !== afterLines[i]) {
      changed += 1;
    }
  }

  return changed;
}

function getProposalSafety(proposal: ChangeProposal | null): ProposalSafety {
  if (!proposal) {
    return {
      isSafe: false,
      reasons: ['No proposal generated.'],
    };
  }

  const reasons: string[] = [];

  if (proposal.changes.length > 1) {
    reasons.push(`Proposal changes ${proposal.changes.length} files. Prefer one file only.`);
  }

  for (const change of proposal.changes) {
    const originalContent =
      typeof (change as any).originalContent === 'string'
        ? (change as any).originalContent
        : '';

    const changedLineCount = originalContent
      ? countChangedLines(originalContent, change.content)
      : 9999;

    if (!originalContent && isLikelyFullFile(change.content)) {
      reasons.push(`${change.filePath} looks like a full-file rewrite.`);
    }

    if (changedLineCount > 300) {
      reasons.push(`${change.filePath} changes ${changedLineCount} lines.`);
    }

    if (!originalContent && change.content.length > 6000) {
      reasons.push(`${change.filePath} change is very large.`);
    }
  }

  return {
    isSafe: reasons.length === 0,
    reasons,
  };
}

function getSimpleDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine !== afterLine) {
      if (i > 0) {
        diffLines.push('  ' + (afterLines[i - 1] ?? ''));
      }

      if (beforeLine !== undefined) {
        diffLines.push('- ' + beforeLine);
      }

      if (afterLine !== undefined) {
        diffLines.push('+ ' + afterLine);
      }

      if (i < maxLen - 1) {
        diffLines.push('  ' + (afterLines[i + 1] ?? ''));
      }
    }
  }

  return diffLines.join('\n');
}

export default function ChangesPage() {
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const safety = useMemo(() => getProposalSafety(proposal), [proposal]);

  async function generateProposal() {
    setIsLoading(true);
    setError('');
    setResult('');
    setProposal(null);

    try {
      const res = await fetch('/api/propose-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const text = await res.text();

      let data: ChangeProposal & { error?: string; raw?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response:\n\n${text}`);
      }

      if (!res.ok) {
        throw new Error(
          data.error + (data.raw ? `\n\nRAW:\n${data.raw}` : '')
        );
      }

      console.log('PROPOSAL DATA', data);
console.log(
  'FIRST CHANGE ORIGINAL:',
  (data.changes?.[0] as any)?.originalContent?.slice(0, 100)
);
      
      setProposal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function applyProposal() {
    if (!proposal) return;

    const currentSafety = getProposalSafety(proposal);

    if (!currentSafety.isSafe) {
      setError(
        `Unsafe proposal blocked:\n${currentSafety.reasons
          .map((reason) => `- ${reason}`)
          .join('\n')}`
      );
      return;
    }

    setIsApplying(true);
    setError('');
    setResult('');

    try {
      const res = await fetch('/api/apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal),
      });

      const text = await res.text();

      let data: {
  branchName?: string;
  compareUrl?: string;
  pullRequestUrl?: string | null;
  error?: string;
};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response:\n\n${text}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply changes');
      }

      if (data.pullRequestUrl) {
        setResult(`Applied to branch: ${data.branchName}\nOpen PR: ${data.pullRequestUrl}\nReview diff: ${data.pullRequestUrl}/files`);
      } else {
        setResult(`Applied to branch: ${data.branchName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Changes</h1>
          <p className="mt-2 text-sm text-white/60">
            Master Agent proposes repo changes. You approve before apply.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-sm font-medium">
            What should be changed?
          </label>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-white outline-none"
            placeholder="Modify only app/chat/page.tsx. Change only sendMessage. Do not rewrite the whole file."
          />

          <p className="mt-2 text-xs text-white/45">
            Tip: ask for one file, one function, one small patch.
          </p>

          <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900 p-3 text-xs text-white/60">
            <div className="mb-2 font-medium text-white/80">Small patch template</div>
            <pre className="whitespace-pre-wrap">
{`Modify only <file>.
Change only <function/block>.
Do not rewrite the whole file.
Do not change imports.
Return code diff only.
Keep changes minimal and focused.
Always verify diff before applying.`}
            </pre>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900 p-3 text-xs text-white/60">
            <div className="mb-2 font-medium text-white/80">Build error fix template</div>
            <pre className="whitespace-pre-wrap">
{`Fix this build error:

<paste full error here including file path and line number>`}
            </pre>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={generateProposal}
              disabled={isLoading || !prompt.trim()}
              className="rounded-xl bg-white px-4 py-2 text-black disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate proposal'}
            </button>

            {proposal && (
              <button
                onClick={applyProposal}
                disabled={isApplying || !safety.isSafe}
                className="rounded-xl border border-white/20 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplying
                  ? 'Applying...'
                  : safety.isSafe
                    ? 'Apply changes'
                    : 'Unsafe proposal'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="whitespace-pre-wrap rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="whitespace-pre-wrap rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {result}
          </div>
        )}

        {proposal && (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-4 ${
                safety.isSafe
                  ? 'border-green-500/30 bg-green-500/10 text-green-200'
                  : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
              }`}
            >
              <div className="font-medium">
                {safety.isSafe
                  ? 'Safe-looking small patch'
                  : 'Unsafe proposal: review before applying'}
              </div>

              {!safety.isSafe && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {safety.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/50">Summary</div>
              <div className="mt-2 text-lg">{proposal.summary}</div>

              <div className="mt-4 text-sm text-white/50">Branch</div>
              <div className="mt-1 break-words">{proposal.branchName}</div>

              <div className="mt-4 text-sm text-white/50">Commit</div>
              <div className="mt-1 break-words">{proposal.commitMessage}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 text-lg font-medium">
                Proposed files ({proposal.changes.length})
              </div>

              <div className="space-y-4">
                {proposal.changes.map((change) => {
                  const originalContent = (change as any).originalContent;
                  const preview =
                    typeof originalContent === 'string'
                      ? getSimpleDiff(originalContent, change.content)
                      : change.content;

                  return (
                    <div
                      key={change.filePath}
                      className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                    >
                      <div className="mb-2 text-sm font-medium text-white/80">
                        {change.filePath}
                      </div>

                      <div className="mb-2 text-xs text-white/40">
                        {change.content.length} characters
                      </div>

                     <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs">
  {preview
    .slice(0, 6000)
    .split('\n')
    .map((line, i) => {
      let color = 'text-white/60';

      if (line.startsWith('+')) color = 'text-green-400';
      else if (line.startsWith('-')) color = 'text-red-400';

      return (
        <div key={i} className={color}>
          {line}
        </div>
      );
    })}
</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
