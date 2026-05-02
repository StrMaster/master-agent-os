import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeNewlines(v: string) {
  return v.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countOccurrences(text: string, find: string) {
  if (!find) return 0;
  return text.split(find).length - 1;
}

function countChangedLines(a: string, b: string) {
  const aL = a.split('\n');
  const bL = b.split('\n');
  let c = 0;
  for (let i = 0; i < Math.max(aL.length, bL.length); i++) {
    if (aL[i] !== bL[i]) c++;
  }
  return c;
}

function replaceLineWindow(original: string, find: string, replace: string) {
  const o = normalizeNewlines(original).split('\n');
  const f = normalizeNewlines(find.trim()).split('\n');

  const matches: number[] = [];

  for (let i = 0; i <= o.length - f.length; i++) {
    let ok = true;
    for (let j = 0; j < f.length; j++) {
      if (o[i + j].trim() !== f[j].trim()) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(i);
  }

  if (matches.length !== 1) {
    return { matches: matches.length, content: original };
  }

  const start = matches[0];
  const end = start + f.length;
  const r = normalizeNewlines(replace).split('\n');

  const result = [
    ...o.slice(0, start),
    ...r,
    ...o.slice(end),
  ];

  return {
    matches: 1,
    content: result.join('\n'),
  };
}

function applyFindReplace(original: string, find: string, replace: string) {
  const o = normalizeNewlines(original);
  const f = normalizeNewlines(find);
  const r = normalizeNewlines(replace);

  const exact = countOccurrences(o, f);

  if (exact === 1) {
    return { content: o.replace(f, r), strategy: 'exact' };
  }

  if (exact > 1) {
    throw new Error(`Find not unique (${exact})`);
  }

  const trimmed = f.trim();
  const trimmedCount = countOccurrences(o, trimmed);

  if (trimmedCount === 1) {
    return { content: o.replace(trimmed, r.trim()), strategy: 'trimmed' };
  }

  const lw = replaceLineWindow(o, f, r);

  if (lw.matches === 1) {
    return { content: lw.content, strategy: 'line-window' };
  }

  throw new Error('Find not found');
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const system = `
Return JSON only.

{
 summary,
 branchName,
 commitMessage,
 changes: [
  { filePath, find, replace }
 ]
}

STRICT RULES:
- EXACTLY ONE change
- "find" must be copied EXACTLY from file
- DO NOT invent code
- DO NOT approximate
- DO NOT reformat
`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0,
      messages: [
  { role: 'system', content: system },
  { role: 'user', content: prompt },
],
    });

    let raw = completion.choices[0]?.message?.content || '';

// 🧼 CLEAN JSON (FIX)
raw = raw
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim();

const parsed = JSON.parse(raw);

    const change = parsed.changes[0];

    const file = change.filePath;

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || 'main';

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${file}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    const original = Buffer.from(data.content, 'base64').toString();

    let updated;
    let strategy;

    try {
      const result = applyFindReplace(original, change.find, change.replace);
      updated = result.content;
      strategy = result.strategy;
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }

    const changedLines = countChangedLines(original, updated);

    const isSafe =
      changedLines < 30 &&
      !change.find.includes('import') &&
      !change.replace.includes('import');

    return Response.json({
      summary: parsed.summary,
      branchName: parsed.branchName,
      commitMessage: parsed.commitMessage,
      isSafe,
      changedLines,
      matchStrategy: strategy,
      changes: [
        {
          filePath: file,
          content: updated,
        },
      ],
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}