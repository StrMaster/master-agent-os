'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMasterStore } from '@/lib/master-store';
import { ChangeProposal } from '@/lib/github-types';

type ProposalSafety = {
  isSafe: boolean;
  reasons: string[];
};

type ProposalWithSafety = ChangeProposal & {
  isSafe?: boolean;
  changedLines?: number;
  matchStrategy?: string;
  buildError?: string;
};

function getProposalSafety(proposal: ProposalWithSafety | null): ProposalSafety {
  if (!proposal) {
    return {
      isSafe: false,
      reasons: ['No proposal generated.'],
    };
  }

  const reasons: string[] = [];

  if (proposal.isSafe === true) {
    return {
      isSafe: true,
      reasons: [],
    };
  }

  if (proposal.changes.length !== 1) {
    reasons.push(`Proposal changes ${proposal.changes.length} files. Prefer exactly one file.`);
  }

  if (typeof proposal.changedLines === 'number' && proposal.changedLines > 30) {
    reasons.push(`Proposal changes ${proposal.changedLines} lines.`);
  }

  if (proposal.matchStrategy === 'fail') {
    reasons.push('Find/replace matching failed.');
  }

  if (reasons.length === 0) {
    reasons.push('Proposal was not marked safe by backend.');
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
  const { completeTask } = useMasterStore();

  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<ProposalWithSafety | null>(null);
  const [hasAutoApplied, setHasAutoApplied] = useState(false);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fixAttemptCount, setFixAttemptCount] = useState(0);

  const safety = useMemo(() => getProposalSafety(proposal), [proposal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPrompt = params.get('prompt');
    const urlError = params.get('error');

    if (urlError) {
      setPrompt(`Fix this build error:

${urlError}

STRICT FIX MODE:
- Fix only the exact build error.
- Modify only the file mentioned in the error.
- Use the exact line number from the error.
- Return exactly one find/replace change.`);
      setShouldAutoGenerate(true);
      return;
    }

    if (urlPrompt) {
      setPrompt(urlPrompt);
      setShouldAutoGenerate(true);
    }
  }, []);

  useEffect(() => {
    if (!shouldAutoGenerate) return;
    if (!prompt.trim()) return;

    setShouldAutoGenerate(false);
    generateProposal();
  }, [shouldAutoGenerate, prompt]);

  useEffect(() => {
    if (!proposal) return;
    if (hasAutoApplied) return;
    if (!safety.isSafe) return;

    setHasAutoApplied(true);
    applyProposal();
  }, [proposal, safety.isSafe, hasAutoApplied]);

  async function generateProposal() {
    if (fixAttemptCount >= 3) {
      setError('Max fix attempts reached.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');
    setProposal(null);
    setHasAutoApplied(false);

    try {
      const res = await fetch('/api/propose-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const text = await res.text();

      let data: ProposalWithSafety & { error?: string; raw?: string };

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

      if (data.buildError) {
        window.location.href = `/changes?error=${encodeURIComponent(data.buildError)}`;
        return;
      }

      setProposal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function applyProposal(skipSafety = false) {
    if (!proposal) return;

    const currentSafety = getProposalSafety(proposal);

    if (!skipSafety && !currentSafety.isSafe) {
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

      const params = new URLSearchParams(window.location.search);
      const taskId = params.get('taskId');

      if (taskId) {
        completeTask({ taskId });
      }

      if (data.pullRequestUrl) {
        setResult(
          `PR created ✅
Branch: ${data.branchName}
Review and merge manually:
${data.pullRequestUrl}

Review diff:
${data.pullRequestUrl}/files`
        );
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
            Master Agent proposes repo changes. Safe proposals can auto-apply.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-sm font-medium">
            What should be changed?
          </label>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-white outline-none"
            placeholder="Modify only app/execution/page.tsx. Add small padding to execution items."
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() =>
                setPrompt(`Fix this build error:

<paste full Vercel build error here>

STRICT FIX MODE:
- Fix only the exact build error.
- Modify only the file mentioned in the error.
- Use the exact line number from the error.
- Return exactly one find/replace change.`)
              }
              className="rounded-xl border border-white/20 px-4 py-2 text-white hover:bg-white/10"
            >
              Auto fix prompt
            </button>

            <button
              onClick={() => generateProposal()}
              disabled={isLoading || !prompt.trim()}
              className="rounded-xl bg-white px-4 py-2 text-black disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate proposal'}
            </button>

            {proposal && (
              <button
                onClick={() => applyProposal()}
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

            {proposal && !safety.isSafe && (
              <button
                onClick={() => applyProposal(true)}
                disabled={isApplying}
                className="rounded-xl border border-red-500/60 px-4 py-2 text-red-200 hover:bg-red-500/10 disabled:opacity-50"
              >
                Apply anyway
              </button>
            )}
          </div>

          <div className="mt-3 text-xs text-white/40">
            Fix attempts: {fixAttemptCount}/3
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

              <div className="mt-2 text-xs opacity-80">
                Changed lines: {proposal.changedLines ?? 'unknown'} · Match:{' '}
                {proposal.matchStrategy ?? 'unknown'}
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