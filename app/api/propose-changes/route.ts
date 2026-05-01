import OpenAI from 'openai';

type ProposeBody = {
  prompt?: string;
  targetFile?: string;
};

type LLMChange = {
  filePath?: string;
  find?: string;
  replace?: string;
};

type LLMProposal = {
  summary?: string;
  branchName?: string;
  commitMessage?: string;
  changes?: LLMChange[];
};

type ProposedChange = {
  filePath: string;
  content: string;
  originalContent?: string;
  find?: string;
  replace?: string;
};

type ChangeProposal = {
  summary: string;
  branchName: string;
  commitMessage: string;
  changes: ProposedChange[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const ALLOWED_PREFIXES = ['app/', 'lib/', 'components/'];

const KNOWN_FILES = [
  'app/chat/page.tsx',
  'app/changes/page.tsx',
  'app/api/master/route.ts',
  'app/api/propose-changes/route.ts',
  'app/api/apply-changes/route.ts',
  'app/execution/page.tsx',
  'app/tasks/page.tsx',
  'app/layout.tsx',
  'lib/master-store.tsx',
  'lib/master-types.ts',
];

function isAllowedFile(filePath: string) {
  return (
    ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
    !filePath.includes('..') &&
    !filePath.startsWith('.env') &&
    !filePath.includes('node_modules') &&
    !filePath.includes('package-lock') &&
    !filePath.includes('vercel')
  );
}

function ensureString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeBranchName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function extractJson(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');

  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return trimmed;
}

function extractTargetFileFromPrompt(prompt: string): string {
  for (const file of KNOWN_FILES) {
    if (prompt.includes(file)) return file;
  }

  const match = prompt.match(
    /\b(app|lib|components)\/[A-Za-z0-9._/-]+\.(tsx|ts|jsx|js)\b/
  );

  return match?.[0] ?? '';
}

async function readFileFromGitHub(filePath: string) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_DEFAULT_BRANCH || 'main';

  if (!owner || !repo || !token) {
    throw new Error('Missing GitHub environment variables');
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) return null;

  const data = await res.json();

  if (typeof data.content !== 'string') return null;

  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString(
    'utf8'
  );
}

function countOccurrences(source: string, find: string) {
  if (!find) return 0;

  let count = 0;
  let index = 0;

  while (true) {
    const found = source.indexOf(find, index);

    if (found === -1) break;

    count += 1;
    index = found + find.length;
  }

  return count;
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countChangedLines(before: string, after: string) {
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

function replaceByTrimmedLineWindow(
  originalContent: string,
  find: string,
  replace: string
) {
  const originalLines = normalizeNewlines(originalContent).split('\n');
  const findLines = normalizeNewlines(find.trim()).split('\n');

  if (findLines.length === 0) {
    return {
      matches: 0,
      updatedContent: originalContent,
    };
  }

  const matchingStarts: number[] = [];

  for (let start = 0; start <= originalLines.length - findLines.length; start += 1) {
    let matches = true;

    for (let offset = 0; offset < findLines.length; offset += 1) {
      if (originalLines[start + offset].trim() !== findLines[offset].trim()) {
        matches = false;
        break;
      }
    }

    if (matches) {
      matchingStarts.push(start);
    }
  }

  if (matchingStarts.length !== 1) {
    return {
      matches: matchingStarts.length,
      updatedContent: originalContent,
    };
  }

  const start = matchingStarts[0];
  const end = start + findLines.length;
  const replaceLines = normalizeNewlines(replace.trim()).split('\n');

  const updatedLines = [
    ...originalLines.slice(0, start),
    ...replaceLines,
    ...originalLines.slice(end),
  ];

  return {
    matches: 1,
    updatedContent: updatedLines.join('\n'),
  };
}

function applyFindReplace(originalContent: string, find: string, replace: string) {
  const normalizedOriginal = normalizeNewlines(originalContent);
  const normalizedFind = normalizeNewlines(find);
  const normalizedReplace = normalizeNewlines(replace);

  const exactMatches = countOccurrences(normalizedOriginal, normalizedFind);

  if (exactMatches === 1) {
    return {
      updatedContent: normalizedOriginal.replace(normalizedFind, normalizedReplace),
      strategy: 'exact',
    };
  }

  if (exactMatches > 1) {
    throw new Error(`Find block is not unique. Found ${exactMatches} matches.`);
  }

  const trimmedFind = normalizedFind.trim();
  const trimmedReplace = normalizedReplace.trim();
  const trimmedMatches = countOccurrences(normalizedOriginal, trimmedFind);

  if (trimmedMatches === 1) {
    return {
      updatedContent: normalizedOriginal.replace(trimmedFind, trimmedReplace),
      strategy: 'trimmed',
    };
  }

  if (trimmedMatches > 1) {
    throw new Error(
      `Find block is not unique after trimming. Found ${trimmedMatches} matches.`
    );
  }

  const lineWindowResult = replaceByTrimmedLineWindow(
    normalizedOriginal,
    normalizedFind,
    normalizedReplace
  );

  if (lineWindowResult.matches === 1) {
    return {
      updatedContent: lineWindowResult.updatedContent,
      strategy: 'trimmed-line-window',
    };
  }

  if (lineWindowResult.matches > 1) {
    throw new Error(
      `Find block is not unique with line matching. Found ${lineWindowResult.matches} matches.`
    );
  }

  throw new Error('Find block not found.');
}

function buildContextLabel(filePath: string, content: string | null) {
  return `FILE: ${filePath}
---
${content ?? 'FILE NOT AVAILABLE'}
---`;
}

function isLikelyBuildError(raw: string) {
  return (
    raw.includes('Failed to type check') ||
    raw.includes('Build error occurred') ||
    raw.includes('Turbopack build failed') ||
    raw.includes('Command "npm run build" exited') ||
    raw.includes('Error: Command "npm run build" exited') ||
    raw.includes('Cannot find name') ||
    raw.includes('Type error:')
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProposeBody;
    const prompt = String(body?.prompt ?? '').trim();
    const requestedTargetFile = String(body?.targetFile ?? '').trim();
    const extractedTargetFile = extractTargetFileFromPrompt(prompt);
    const targetFile = requestedTargetFile || extractedTargetFile;

    if (!prompt) {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    if (targetFile && !isAllowedFile(targetFile)) {
      return Response.json(
        { error: `Blocked targetFile: ${targetFile}` },
        { status: 400 }
      );
    }

    const contextFiles = new Set<string>();

    if (targetFile) {
      contextFiles.add(targetFile);
    } else {
      contextFiles.add('app/changes/page.tsx');
      contextFiles.add('app/chat/page.tsx');
      contextFiles.add('lib/master-store.tsx');
      contextFiles.add('lib/master-types.ts');
    }

    const contextBlocks: string[] = [];

    for (const file of contextFiles) {
      const content = await readFileFromGitHub(file);
      contextBlocks.push(buildContextLabel(file, content));
    }

    const systemPrompt = `
You are a strict code patch generator for a TypeScript + React Next.js codebase.

Return ONLY valid JSON.

Output shape:
{
  "summary": "short description",
  "branchName": "agent/short-branch-name",
  "commitMessage": "type: short commit message",
  "changes": [
    {
      "filePath": "path/to/file",
      "find": "exact existing code block",
      "replace": "replacement code block"
    }
  ]
}

CRITICAL OUTPUT RULES:
- Return exactly ONE change.
- Use find/replace only.
- Do not return full file content.
- Do not return markdown.
- Do not include explanations outside JSON.
- Do not create files.
- Modify exactly one file.

FIND/REPLACE RULES:
- The find field must be copied from the provided file context.
- Prefer the smallest unique exact block.
- Avoid huge find blocks.
- Avoid generic lines that may appear multiple times.
- If one line is too generic, include 1-3 surrounding lines.
- The replace field must include the full replacement for that exact block.
- Do not return empty changes.

REACT + TYPESCRIPT RULES:
- Never pass parameterized functions directly to onClick.
- If a function accepts parameters, wrap it:
  onClick={() => fn(arg)}
- React event handlers must match React types.
- Do not introduce TypeScript errors.
- Do not change function signatures unless required.

FIX MODE:
If the request contains a build error:
- Fix only the exact build error.
- Modify only the file mentioned in the error.
- Do not refactor.
- Do not improve unrelated code.
- Make the smallest possible change.

UI RULES:
- Prefer className/text/small JSX tweaks.
- Do not restructure large layouts.
- Do not duplicate components.

FINAL CHECK:
- Exactly one file.
- Exactly one find/replace change.
- Valid JSON.
- Minimal change.
`.trim();

    const userPrompt = `
USER REQUEST:
${prompt}

TARGET FILE:
${targetFile || 'auto-select exactly one relevant file'}

PROJECT CONTEXT:
${contextBlocks.join('\n\n')}

Return JSON only.
`.trim();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = ensureString(completion.choices[0]?.message?.content, '');
    const jsonText = extractJson(raw);

    let parsed: LLMProposal;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return Response.json(
        {
          error: 'Model returned invalid JSON',
          raw,
        },
        { status: 500 }
      );
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.changes)) {
      return Response.json(
        {
          error: 'Model returned invalid proposal shape',
          parsed,
        },
        { status: 500 }
      );
    }

    if (parsed.changes.length === 0) {
      return Response.json({
        summary: ensureString(parsed.summary, 'Clarification needed'),
        branchName: 'agent/clarification-needed',
        commitMessage: 'chore: clarification needed',
        changes: [],
      });
    }

    if (parsed.changes.length !== 1) {
      return Response.json(
        {
          error: 'Model must return exactly one change',
          parsed,
        },
        { status: 500 }
      );
    }

    const llmChange = parsed.changes[0];
    const changedFile = ensureString(llmChange.filePath || targetFile).trim();
    const find = ensureString(llmChange.find);
    const replace = ensureString(llmChange.replace);

    if (!changedFile || !find || !replace) {
      return Response.json(
        {
          error: 'Model returned incomplete find/replace change',
          parsed,
        },
        { status: 500 }
      );
    }

    if (!isAllowedFile(changedFile)) {
      return Response.json(
        {
          error: `Blocked file path: ${changedFile}`,
          parsed,
        },
        { status: 500 }
      );
    }

    if (targetFile && changedFile !== targetFile) {
      return Response.json(
        {
          error: `Model changed wrong file. Expected ${targetFile}, got ${changedFile}`,
          parsed,
        },
        { status: 500 }
      );
    }

    const originalContent = await readFileFromGitHub(changedFile);

    if (!originalContent) {
      return Response.json(
        {
          error: `Could not read target file: ${changedFile}`,
          parsed,
        },
        { status: 500 }
      );
    }

    let updatedContent: string;
    let matchStrategy: string;

    try {
      const result = applyFindReplace(originalContent, find, replace);
      updatedContent = result.updatedContent;
      matchStrategy = result.strategy;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return Response.json(
        {
          error: message,
          parsed,
          find,
        },
        { status: 500 }
      );
    }

    const changedLinesCount = countChangedLines(originalContent, updatedContent);
    const noImportsChanged = !/^\s*import\s/m.test(find) && !/^\s*import\s/m.test(replace);

    const lowerPrompt = prompt.toLowerCase();

    const isFeatureMode =
      prompt.includes('Feature mode: allowed') ||
      lowerPrompt.includes('improve') ||
      lowerPrompt.includes('polish') ||
      lowerPrompt.includes('refactor') ||
      lowerPrompt.includes('redesign') ||
      lowerPrompt.includes('ui') ||
      lowerPrompt.includes('layout') ||
      lowerPrompt.includes('spacing') ||
      lowerPrompt.includes('border') ||
      lowerPrompt.includes('readability');

    const maxChangedLines = isFeatureMode ? 200 : 50;

    if (changedLinesCount > maxChangedLines) {
      return Response.json(
        {
          error: `Too many lines changed (${changedLinesCount}). Maximum allowed is ${maxChangedLines}.`,
          parsed,
          matchStrategy,
        },
        { status: 500 }
      );
    }

    if (!noImportsChanged && changedLinesCount > 20) {
      return Response.json(
        {
          error: 'Import changes with larger patches are blocked.',
          parsed,
          matchStrategy,
        },
        { status: 500 }
      );
    }

    const safeSummary = ensureString(parsed.summary, 'Update file');
    const safeBranch =
      sanitizeBranchName(ensureString(parsed.branchName, 'agent/update-file')) ||
      'agent/update-file';
    const safeCommit =
      ensureString(parsed.commitMessage, 'feat: update file') || 'feat: update file';

    const response: ChangeProposal & { buildError?: string; matchStrategy?: string } = {
      summary: safeSummary,
      branchName: safeBranch.startsWith('agent/') ? safeBranch : `agent/${safeBranch}`,
      commitMessage: safeCommit,
      matchStrategy,
      changes: [
        {
          filePath: changedFile,
          content: updatedContent,
          originalContent,
          find,
          replace,
        },
      ],
    };

    if (isLikelyBuildError(raw)) {
      response.buildError = raw.trim();
    }

    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown propose-changes error';

    return Response.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}