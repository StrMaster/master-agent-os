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

function buildContextLabel(filePath: string, content: string | null) {
  return `${filePath}
<<FILE>>
${content ?? 'FILE NOT AVAILABLE'}
<<END FILE>>`;
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
You are a strict code patch generator for a TypeScript + React (Next.js) codebase.

Your job:
Generate a minimal, safe code change based on the user request.

You MUST follow all rules below.

---

OUTPUT FORMAT (CRITICAL)

Return ONLY valid JSON.

Each change must be a complete find/replace patch:
- filePath
- find
- replace

The find field must contain the exact existing code block.
The replace field must contain the full replacement for that exact block.
Do not return full file content.
Do not return partial diffs.
Do not return markdown.
Return exactly one change.

For React handlers:
- If a function has parameters, wrap it:
  onClick={() => fn(arg)}
- Never pass a parameterized function directly to onClick.

{
  "summary": "short description",
  "changes": [
    {
      "filePath": "path/to/file",
      "content": "full updated file content"
    }
  ]
}

- changes array MUST contain exactly ONE item
- Do NOT include explanations outside JSON
- Do NOT include markdown
- Do NOT include comments outside code

---

STRICT PATCH RULES

- Modify EXACTLY ONE file
- Do NOT create new files
- Do NOT modify multiple files
- Keep changes minimal and focused
- Do NOT rewrite the entire file unless absolutely necessary
- Prefer editing existing lines instead of adding large blocks
- Match existing code structure exactly

---

MATCHING RULES

- Always match existing code patterns
- Reuse existing variable names and functions
- Do NOT invent new architecture
- If exact match is not found, modify the closest matching block
- NEVER return empty changes

---

REACT + TYPESCRIPT CRITICAL RULES

- NEVER pass functions directly to onClick if they expect arguments

WRONG:
onClick={someFunction}

CORRECT:
onClick={() => someFunction()}

- If function accepts parameters → ALWAYS wrap in arrow function

- React event handlers must match expected types
- Do NOT introduce TypeScript errors
- Do NOT change function signatures unless required to fix an error

---

FIX MODE (VERY IMPORTANT)

If the request includes a build error:

- ONLY fix the exact error
- DO NOT refactor unrelated code
- DO NOT improve code
- DO NOT add features
- DO NOT rename variables unnecessarily
- DO NOT change structure

Goal:
Make the build pass with the smallest possible change

---

MINIMAL CHANGE STRATEGY

Always prefer:

- 1–10 lines change ✅
- editing existing lines ✅
- small additions ✅

Avoid:

- full component rewrites ❌
- large refactors ❌
- formatting-only changes ❌

---

UI CHANGE RULES

When modifying UI:

- Only change className or small JSX parts
- Do NOT restructure layout
- Do NOT move large blocks
- Do NOT duplicate components

---

SAFETY AWARENESS

If unsure:

- Modify the smallest possible block
- Prefer safe, visible UI tweaks
- Avoid risky logic changes

---

FINAL CHECK (MANDATORY)

Before returning:

- Exactly 1 file changed
- No TypeScript errors introduced
- React event handlers are valid
- JSON is valid
- Change is minimal

If any rule is violated → FIX before returning
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

    const occurrences = countOccurrences(originalContent, find);

    if (occurrences !== 1) {
      return Response.json(
        {
          error: `Find block must match exactly once. Found ${occurrences} matches.`,
          parsed,
          find,
        },
        { status: 500 }
      );
    }

    const updatedContent = originalContent.replace(find, replace);

const changedLines =
  find.split('\n').length + replace.split('\n').length;

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

    const safeSummary = ensureString(parsed.summary, 'Update file');
    const safeBranch =
      sanitizeBranchName(ensureString(parsed.branchName, 'agent/update-file')) ||
      'agent/update-file';
    const safeCommit =
      ensureString(parsed.commitMessage, 'feat: update file') ||
      'feat: update file';

    const response: ChangeProposal = {
      summary: safeSummary,
      branchName: safeBranch.startsWith('agent/')
        ? safeBranch
        : `agent/${safeBranch}`,
      commitMessage: safeCommit,
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
