import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';

type ProposeBody = {
  prompt?: string;
  targetFile?: string;
};

type ProposedChange = {
  filePath: string;
  content: string;
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
  return ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

async function readProjectFile(filePath: string) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    return await fs.readFile(fullPath, 'utf8');
  } catch {
    return null;
  }
}

function sanitizeBranchName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function ensureString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
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

  const match = prompt.match(/\b(app|lib|components)\/[A-Za-z0-9._/-]+\.(tsx|ts|jsx|js)\b/);
  return match?.[0] ?? '';
}

function promptForbidsImportChanges(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes('do not change imports') ||
    lower.includes('do not modify imports') ||
    lower.includes('neliesk import') ||
    lower.includes('nekeisk import')
  );
}

function getImportBlock(content: string) {
  return content
    .split('\n')
    .filter((line) => line.trim().startsWith('import '))
    .join('\n')
    .trim();
}

function promptRequestsFullRewrite(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes('rewrite full file') ||
    lower.includes('replace whole file') ||
    lower.includes('pakeisk visa faila') ||
    lower.includes('pakeisk visą failą') ||
    lower.includes('pilnas skriptas') ||
    lower.includes('full script')
  );
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

    async function readFileFromGitHub(filePath: string) {
  const res = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${filePath}?ref=${process.env.GITHUB_DEFAULT_BRANCH || 'main'}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return Buffer.from(data.content, 'base64').toString('utf8');
}
    
    const targetFileContent = targetFile
  ? await readFileFromGitHub(targetFile)
  : null;

    if (targetFile && !targetFileContent) {
      return Response.json(
        { error: `Could not read target file: ${targetFile}` },
        { status: 400 }
      );
    }

    const contextFiles = new Set<string>();

    if (targetFile) {
      contextFiles.add(targetFile);
    }

    contextFiles.add('lib/master-types.ts');
    contextFiles.add('lib/master-store.tsx');

    if (prompt.includes('chat') || targetFile === 'app/chat/page.tsx') {
      contextFiles.add('app/chat/page.tsx');
    }

    if (prompt.includes('changes') || targetFile === 'app/changes/page.tsx') {
      contextFiles.add('app/changes/page.tsx');
    }

    if (prompt.includes('execution') || targetFile === 'app/execution/page.tsx') {
      contextFiles.add('app/execution/page.tsx');
    }

    if (prompt.includes('task') || targetFile === 'app/tasks/page.tsx') {
      contextFiles.add('app/tasks/page.tsx');
    }

    const contextBlocks: string[] = [];

    for (const file of contextFiles) {
  const content = await readFileFromGitHub(file);
  contextBlocks.push(buildContextLabel(file, content));
}

    const fullRewriteAllowed = promptRequestsFullRewrite(prompt);

    const systemPrompt = `
You are a careful code modification engine for an existing Next.js project.

Return ONLY valid JSON.
Do NOT write explanations.
Do NOT write markdown.
Do NOT write code fences.

Output format:
{
  "summary": "...",
  "branchName": "agent/...",
  "commitMessage": "feat: ...",
  "changes": [
    {
      "filePath": "...",
      "content": "FULL UPDATED FILE CONTENT"
    }
  ]
}

IMPORTANT IMPLEMENTATION RULES:
- changes[0].content must be the full updated file content.
- Make the smallest possible code change inside the full file.
- Preserve all unrelated code exactly.
- Preserve all unrelated code exactly.
- Do not rewrite or reformat unrelated sections.
- Do not change imports unless the user explicitly asks for import changes.
- Do not change exports unless explicitly asked.
- Do not rename existing variables or functions unless explicitly asked.
- Do not move functions unless explicitly asked.
- Do not add dependencies.
- Do not create new files.
- Do not rename files.
- Do not modify more than one file.
- Do not invent store methods or APIs.
- Do not replace real logic with mock data.
- Use subtasks.done, never completed.

TARGETING RULES:
- If TARGET FILE is provided, modify ONLY that file.
- If TARGET FILE is not provided, choose exactly one best file.
- If the user asks to change one function/block, change only that function/block.
- If the user says "do not change imports", imports must remain byte-for-byte the same.
- If unsure, return a safe proposal with changes: [] and explain clarification needed in summary.

FULL REWRITE POLICY:
- Full rewrites are NOT allowed unless the user explicitly asks for full rewrite / full script / replace whole file.
- If full rewrite is not allowed, preserve existing file structure and make a minimal edit inside the requested block.
`.trim();

    const userPrompt = `
USER REQUEST:
${prompt}

TARGET FILE:
${targetFile || 'auto-select exactly one relevant file'}

FULL REWRITE ALLOWED:
${fullRewriteAllowed ? 'yes' : 'no'}

PROJECT CONTEXT:
${contextBlocks.join('\n\n')}

RESPONSE REQUIREMENTS:
- Return JSON only.
- originalContent: originalChangedFileContent
- changes must contain exactly one item unless clarification is needed.
- changes[0].filePath must be the target file if target file is provided.
- changes[0].content must be the full updated content of that one file.
- The actual code modification must be minimal and match the user request.
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

    let parsed: ChangeProposal;

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

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.changes)
    ) {
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
          error: 'Model must return exactly one file change',
          parsed,
        },
        { status: 500 }
      );
    }

    const changedFile = ensureString(parsed.changes[0]?.filePath).trim();
    const changedContent = ensureString(parsed.changes[0]?.content);

    if (!changedFile || !changedContent) {
      return Response.json(
        {
          error: 'Model returned incomplete change data',
          parsed,
        },
        { status: 500 }
      );
    }

   

    if (!isAllowedFile(changedFile)) {
      return Response.json(
        {
          error: `Model changed blocked file: ${changedFile}`,
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

    const originalChangedFileContent = await readFileFromGitHub(changedFile);

    if (!originalChangedFileContent) {
      return Response.json(
        {
          error: `Could not read changed file for validation: ${changedFile}`,
          parsed,
        },
        { status: 500 }
      );
    }

    // Skip import validation for diff mode
if (
  promptForbidsImportChanges(prompt) &&
  !changedContent.includes('@@') // diff marker
) {
  const originalImports = getImportBlock(originalChangedFileContent);
  const newImports = getImportBlock(changedContent);

  if (originalImports !== newImports) {
    return Response.json(
      {
        error: 'Model changed imports even though prompt forbids import changes',
        parsed,
      },
      { status: 500 }
    );
  }
}

    if (
      changedFile === 'app/execution/page.tsx' &&
      !changedContent.includes('useMasterStore')
    ) {
      return Response.json(
        {
          error: 'Proposal does not use useMasterStore',
          parsed,
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

    const response: ChangeProposal = {
      summary: safeSummary,
      branchName: safeBranch.startsWith('agent/')
        ? safeBranch
        : `agent/${safeBranch}`,
      commitMessage: safeCommit,
      changes: [
        {
          filePath: changedFile,
          content: changedContent,
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
