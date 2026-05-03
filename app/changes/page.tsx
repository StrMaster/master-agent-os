'use client';

import { useEffect, useState } from 'react';

export default function ChangesPage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      setPrompt(`Fix this error:\n\n${decodeURIComponent(error)}`);
    }
  }, []);

  async function run() {
    setLoading(true);

    const filePath = 'app/execution/page.tsx';

    const file = await fetch(`/api/read-file?path=${filePath}`).then((r) =>
      r.text()
    );

    const propose = await fetch('/api/propose-changes', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        filePath,
        original: file,
      }),
    }).then((r) => r.json());

    if (propose.error) {
      alert(propose.error);
      setLoading(false);
      return;
    }

    const apply = await fetch('/api/apply-changes', {
      method: 'POST',
      body: JSON.stringify(propose),
    }).then((r) => r.json());

    if (apply.error) {
      window.location.href =
        '/changes?error=' + encodeURIComponent(apply.buildError);
      return;
    }

    alert('PR created');
    setLoading(false);
  }

  return (
    <div className="p-6">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-40 bg-black text-white"
      />
      <button onClick={run} disabled={loading}>
        Run
      </button>
    </div>
  );
}