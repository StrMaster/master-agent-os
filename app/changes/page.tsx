'use client';

import { useState } from 'react';
import { ChangeProposal } from '@/lib/github-types';

export default function ChangesPage() {
  const [prompt, setPrompt] = useState(
    'Sutvarkyk execution page taip, kad rodytų assigned agent ir execution progress.'
  );
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function generateProposal() {
  setIsLoading(true);
  setError('');
  setResult('');

  try {
    const res = await fetch('/api/propose-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  prompt,
  targetFile: 'app/execution/page.tsx',
}),
    });

    const text = await res.text();

    let data: any;
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

    setProposal(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setIsLoading(false);
  }
}

  async function applyProposal() {
  if (!proposal) return;

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

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response:\n\n${text}`);
    }

    if (!res.ok) {
      throw new Error(data.error || 'Failed to apply changes');
    }

    setResult(`Applied to branch: ${data.branchName}\n${data.compareUrl}`);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setIsApplying(false);
  }
}

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Changes</h1>
          <p className="mt-2 text-white/60">
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
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-white outline-none"
          />

          <div className="mt-4 flex gap-3">
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
                disabled={isApplying}
                className="rounded-xl border border-white/20 px-4 py-2 disabled:opacity-50"
              >
                {isApplying ? 'Applying...' : 'Apply changes'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="whitespace-pre-wrap rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {result}
          </div>
        )}

        {proposal && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/50">Summary</div>
              <div className="mt-2 text-lg">{proposal.summary}</div>

              <div className="mt-4 text-sm text-white/50">Branch</div>
              <div className="mt-1">{proposal.branchName}</div>

              <div className="mt-4 text-sm text-white/50">Commit</div>
              <div className="mt-1">{proposal.commitMessage}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 text-lg font-medium">
                Proposed files ({proposal.changes.length})
              </div>

              <div className="space-y-4">
                {proposal.changes.map((change) => (
                  <div
                    key={change.filePath}
                    className="rounded-xl border border-white/10 bg-neutral-900 p-4"
                  >
                    <div className="mb-2 text-sm font-medium text-white/80">
                      {change.filePath}
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-white/60">
                      {change.content.slice(0, 2000)}
                      {change.content.length > 2000 ? '\n\n...truncated' : ''}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}