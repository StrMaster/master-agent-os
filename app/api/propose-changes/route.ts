import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

const KNOWN_FILES = [
  'app/chat/page.tsx',
  'app/changes/page.tsx',
  'app/execution/page.tsx',
  'app/tasks/page.tsx',
  'app/api/apply-changes/route.ts',
  'app/api/propose-changes/route.ts',
  'app/api/master/route.ts',
  'lib/master-store.tsx',
  'lib/master-types.ts',
];

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countOccurrences(text: string, find: string) {
  if (!find) return 0;
  return text.split(find).length - 1;
}

function countChangedLines(before: string, after: string) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  let changed = 0;

  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i += 1) {
    if (beforeLines[i] !== afterLines[i]) changed += 1;
  }

  return changed;
}

function extractJson(text: string) {
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');

  if (first >= 0 && last > first) {
    return clean.slice(first, last + 1);
  }

  return clean;
}

function validateGeneratedContent(filePath: string, content: string) {
  const errors: string[] = [];

  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    const openDivs = (content.match(/<div(\s|>)/g) || []).length;
    const closeDivs = (content.match(/<\/div>/g) || []).length;

    if (openDivs !== closeDivs) {
      errors.push(`JSX div mismatch: ${openDivs} opening, ${closeDivs} closing`);
    }

    if (/<div\s*\n\s*</.test(content)) {
      errors.push('Broken JSX: found unfinished <div before another tag');
    }

    const completedEmptyStates =
      (content.match(/No completed tasks/g) || []).length +
      (content.match(/No completed tasks yet/g) || []).length;

    if (completedEmptyStates > 1) {
      errors.push('Duplicate completed tasks empty-state detected');
    }
  }

  return errors;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    // bandymas pataisyti escape
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');

    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');

    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }

    throw new Error('Invalid JSON from model');
  }
}

function extractTargetFile(prompt: string) {
  for (const file of KNOWN_FILES) {
    if (prompt.includes(file)) return file;
  }

  const match = prompt.match(
    /\b(app|lib|components)\/[A-Za-z0-9._/-]+\.(tsx|ts|jsx|js)\b/
  );

  return match?.[0] || '';
}

function isAllowedFile(filePath: string) {
  return (
    (filePath.startsWith('app/') ||
      filePath.startsWith('lib/') ||
      filePath.startsWith('components/')) &&
    !filePath.includes('..') &&
    !filePath.includes('node_modules') &&
    !filePath.startsWith('.env')
  );
}

function sanitizeBranchName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function readFileFromGitHub(filePath: string) {
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
    throw new Error('Missing GitHub environment variables');
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_DEFAULT_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not read target file: ${filePath}\n${text}`);
  }

  const data = await res.json();

  if (typeof data.content !== 'string') {
    throw new Error(`Invalid GitHub file response for ${filePath}`);
  }

  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

function replaceLineWindow(original: string, find: string, replace: string) {
  const originalLines = normalizeNewlines(original).split('\n');
  const findLines = normalizeNewlines(find.trim()).split('\n');
  const matches: number[] = [];

  for (let i = 0; i <= originalLines.length - findLines.length; i += 1) {
    let ok = true;

    for (let j = 0; j < findLines.length; j += 1) {
      if (originalLines[i + j].trim() !== findLines[j].trim()) {
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
  const end = start + findLines.length;
  const replaceLines = normalizeNewlines(replace.trim()).split('\n');

  return {
    matches: 1,
    content: [
      ...originalLines.slice(0, start),
      ...replaceLines,
      ...originalLines.slice(end),
    ].join('\n'),
  };
}

function applyFindReplace(original: string, find: string, replace: string) {
  const normalizedOriginal = normalizeNewlines(original);
  const normalizedFind = normalizeNewlines(find);
  const normalizedReplace = normalizeNewlines(replace);

  const exactMatches = countOccurrences(normalizedOriginal, normalizedFind);

  if (exactMatches === 1) {
    return {
      content: normalizedOriginal.replace(normalizedFind, normalizedReplace),
      strategy: 'exact',
    };
  }

  if (exactMatches > 1) {
    throw new Error(`Find not unique (${exactMatches})`);
  }

  const trimmedFind = normalizedFind.trim();
  const trimmedMatches = countOccurrences(normalizedOriginal, trimmedFind);

  if (trimmedMatches === 1) {
    return {
      content: normalizedOriginal.replace(trimmedFind, normalizedReplace.trim()),
      strategy: 'trimmed',
    };
  }

  if (trimmedMatches > 1) {
    throw new Error(`Find not unique after trim (${trimmedMatches})`);
  }

  const lineWindow = replaceLineWindow(
    normalizedOriginal,
    normalizedFind,
    normalizedReplace
  );

  if (lineWindow.matches === 1) {
    return {
      content: lineWindow.content,
      strategy: 'line-window',
    };
  }

  if (lineWindow.matches > 1) {
    throw new Error(`Find not unique with line-window (${lineWindow.matches})`);
  }

  throw new Error('Find not found');
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const targetFile = extractTargetFile(prompt);

    if (!targetFile) {
      return Response.json(
        { error: 'Could not detect target file from prompt.' },
        { status: 400 }
      );
    }

    if (!isAllowedFile(targetFile)) {
      return Response.json(
        { error: `Blocked target file: ${targetFile}` },
        { status: 400 }
      );
    }

    const original = await readFileFromGitHub(targetFile);

    const system = `
Return JSON only.

Shape:
{
  "summary": "short summary",
  "branchName": "agent/short-name",
  "commitMessage": "type: message",
  "changes": [
    {
      "filePath": "${targetFile}",
      "find": "exact code copied from FILE CONTENT",
      "replace": "replacement code"
    }
  ]
}

Rules:
- Return exactly ONE change.
- Modify only ${targetFile}.
- "find" MUST be copied character-for-character from FILE CONTENT.
- Do not invent code.
- Do not reformat find.
- Do not use markdown.
- Do not return full file content.
- Prefer small unique find blocks.
- Escape all quotes correctly in JSON
- Do not include backticks
- Do not include markdown
- Do not duplicate existing UI blocks
- If replacing content, remove old version
- Ensure valid JSX structure
- Do not leave unclosed tags
`.trim();

    const user = `
TASK:
${prompt}

FILE CONTENT:
${original.slice(0, 12000)}

IMPORTANT:
The "find" field must exist exactly in FILE CONTENT.
Return STRICT JSON.
No markdown.
No backticks.
No explanations.
Return JSON only.
`.trim();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = safeJsonParse(raw);

    if (!Array.isArray(parsed.changes) || parsed.changes.length !== 1) {
      return Response.json(
        { error: 'Model must return exactly one change', parsed },
        { status: 500 }
      );
    }

    const change = parsed.changes[0];

    if (
      change.filePath !== targetFile ||
      typeof change.find !== 'string' ||
      typeof change.replace !== 'string'
    ) {
      return Response.json(
        { error: 'Model returned invalid find/replace change', parsed },
        { status: 500 }
      );
    }

    const result = applyFindReplace(original, change.find, change.replace);
    const updated = result.content;

    if (updated === original) {
      return Response.json(
        { error: 'No file changes produced', parsed },
        { status: 500 }
      );
    }

    let finalUpdated = updated;
let finalParsed = parsed;
let finalChange = change;
let finalResult = result;
let validationErrors = validateGeneratedContent(targetFile, finalUpdated);

if (validationErrors.length > 0) {
  const retryPrompt = `
The previous patch failed validation:

${validationErrors.map((item) => `- ${item}`).join('\n')}

Fix the patch.

Rules:
- Return JSON only.
- Return exactly ONE change.
- Modify only ${targetFile}.
- Do NOT duplicate existing UI blocks.
- If the task asks for an empty state, replace the existing empty state instead of adding another.
- Ensure valid JSX.
- Use find text copied exactly from FILE CONTENT.
- Do not refactor.

ORIGINAL TASK:
${prompt}

FILE CONTENT:
${original.slice(0, 12000)}
`.trim();

  const retryCompletion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: retryPrompt },
    ],
  });

  const retryRaw = retryCompletion.choices[0]?.message?.content || '';
  finalParsed = safeJsonParse(retryRaw);

  if (!Array.isArray(finalParsed.changes) || finalParsed.changes.length !== 1) {
    return Response.json(
      { error: 'Retry model must return exactly one change', parsed: finalParsed },
      { status: 500 }
    );
  }

  finalChange = finalParsed.changes[0];

  if (
    finalChange.filePath !== targetFile ||
    typeof finalChange.find !== 'string' ||
    typeof finalChange.replace !== 'string'
  ) {
    return Response.json(
      { error: 'Retry model returned invalid find/replace change', parsed: finalParsed },
      { status: 500 }
    );
  }

  finalResult = applyFindReplace(original, finalChange.find, finalChange.replace);
  finalUpdated = finalResult.content;
  validationErrors = validateGeneratedContent(targetFile, finalUpdated);

  if (validationErrors.length > 0) {
    return Response.json(
      {
        error: `Generated patch failed validation after retry:\n${validationErrors
          .map((item) => `- ${item}`)
          .join('\n')}`,
      },
      { status: 500 }
    );
  }
}

    const changedLines = countChangedLines(original, finalUpdated);

const isSafe =
  changedLines < 30 &&
  !finalChange.find.includes('import ') &&
  !finalChange.replace.includes('import ');

return Response.json({
  summary: finalParsed.summary || 'Update file',
  branchName:
    sanitizeBranchName(finalParsed.branchName || 'agent/update-file') ||
    'agent/update-file',
  commitMessage: finalParsed.commitMessage || 'feat: update file',
  isSafe,
  changedLines,
  matchStrategy: finalResult.strategy,
  changes: [
    {
      filePath: targetFile,
      content: finalUpdated,
      originalContent: original,
    },
  ],
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