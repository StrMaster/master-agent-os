import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ChangeProposal } from '@/lib/github-types';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ProposeBody = {
  prompt?: string;
  targetFile?: string;
};

const ALLOWED_TARGET_PREFIXES = ['app/', 'lib/', 'components/'];

function isAllowedFile(filePath: string) {
  return (
    ALLOWED_TARGET_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
    !filePath.includes('..') &&
    !filePath.startsWith('.env') &&
    !filePath.includes('node_modules') &&
    !filePath.includes('package-lock') &&
    !filePath.includes('vercel')
  );
}

async function readProjectFile(filePath: string) {
  try {
    const absolutePath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return content;
  } catch {
    return null;
  }
}

function buildBranchName(targetFile: string) {
  const cleaned = targetFile
    .replace(/\.[^/.]+$/, '')
    .replace(/[^\w/.-]+/g, '')
    .replace(/\//g, '-')
    .replace(/\./g, '-')
    .toLowerCase();

  return `agent/update-${cleaned}-${Date.now()}`;
}

function buildCommitMessage(targetFile: string) {
  return `feat: update ${targetFile}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProposeBody;
    const prompt = String(body?.prompt ?? '').trim();
    const targetFile = String(body?.targetFile ?? '').trim();

    if (!prompt) {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    if (!targetFile) {
      return Response.json({ error: 'Missing targetFile' }, { status: 400 });
    }

    if (!isAllowedFile(targetFile)) {
      return Response.json(
        { error: `Blocked targetFile: ${targetFile}` },
        { status: 400 }
      );
    }

    const targetFileContent = await readProjectFile(targetFile);
    const masterStoreContent = await readProjectFile('lib/master-store.tsx');
    const masterTypesContent = await readProjectFile('lib/master-types.ts');
    const layoutContent = await readProjectFile('app/layout.tsx');

    if (!targetFileContent) {
      return Response.json(
        { error: `Could not read target file: ${targetFile}` },
        { status: 400 }
      );
    }
const repoContext = `
Project structure:

- app/execution/page.tsx
- lib/master-store.tsx
- tasks have: { id, title, subtasks[] }
- subtasks have: { id, title, done }
- useMasterStore() returns:
  { tasks, agents, sendToExecution, toggleSubtask, assignTaskToAgent }

IMPORTANT:
- Always use: subtask.done (NOT completed)
- Always import from: @/lib/master-store
- Page must start with: 'use client'
`.trim();
    const systemPrompt = `
    You are a senior software engineer.

Return ONLY valid JSON.

DO NOT write explanations.
DO NOT write markdown.
DO NOT write code blocks.

Format:

{
  "summary": "...",
  "branch": "...",
  "commit": "...",
  "files": [
    {
      "path": "...",
      "content": "FULL FILE CONTENT"
    }
  ]
}
You are a coding change planner for an existing Next.js project.

YOUR JOB:
- modify ONLY the target file
- preserve the existing project architecture
- use the existing store/types APIs exactly as provided
- return ONLY valid JSON
- return the FULL updated file content, not a diff

STRICT RULES:
- DO NOT create new files
- DO NOT rename files
- DO NOT modify any file except the target file
- DO NOT invent new APIs
- DO NOT invent new store methods
- DO NOT replace real logic with mock data
- DO NOT simplify away existing functionality
- DO NOT wrap JSON in markdown
- DO NOT output any text before or after JSON

MODIFICATION RULES:
- Modify ONLY the target file
- Preserve existing logic
- Do NOT rewrite unrelated parts
- Do NOT create new files
- Do NOT invent new store APIs
- Use existing store API exactly as found in the provided project context
- Return full file content for the target file only

FORBIDDEN:
- app/example/page.tsx
- mock data
- masterStore.getTasks
- completed property

JSON FORMAT:
{
  "summary": "short summary",
  "branchName": "agent/...",
  "commitMessage": "feat: ...",
  "changes": [
    {
      "filePath": "target/file.tsx",
      "content": "FULL FILE CONTENT HERE"
    }
  ]
}

IMPORTANT:
- changes must contain EXACTLY ONE item
- changes[0].filePath must be exactly the target file path
`.trim();

    const userPrompt = `
USER REQUEST:
${prompt}

TARGET FILE:
${targetFile}

CURRENT TARGET FILE CONTENT:
<<<TARGET_FILE_START>>>
${targetFileContent}
<<<TARGET_FILE_END>>>

RELEVANT PROJECT CONTEXT: lib/master-store.tsx
<<<MASTER_STORE_START>>>
${masterStoreContent ?? 'FILE NOT AVAILABLE'}
<<<MASTER_STORE_END>>>

RELEVANT PROJECT CONTEXT: lib/master-types.ts
<<<MASTER_TYPES_START>>>
${masterTypesContent ?? 'FILE NOT AVAILABLE'}
<<<MASTER_TYPES_END>>>

RELEVANT PROJECT CONTEXT: app/layout.tsx
<<<LAYOUT_START>>>
${layoutContent ?? 'FILE NOT AVAILABLE'}
<<<LAYOUT_END>>>

OUTPUT REQUIREMENTS:
- modify ONLY ${targetFile}
- keep existing logic unless the user explicitly asked to remove it
- use the real project store/types
- preserve current behavior and styling unless the request says otherwise
- return a full valid JSON object only
`.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: repoContext },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    console.log('RAW PROPOSAL OUTPUT:', raw);

    if (!raw.trim().startsWith('{')) {
  return Response.json(
    { error: 'Model did not return JSON', raw },
    { status: 500 }
  );
    }

    let parsed: ChangeProposal;

    try {
      parsed = JSON.parse(raw) as ChangeProposal;
    } catch {
      return Response.json(
        {
          error: 'Model returned invalid JSON',
          raw,
        },
        { status: 500 }
      );
    }

    // ✅ VALIDATION (čia tavo naujas blokas)

const content = parsed.changes?.[0]?.content ?? '';

const forbiddenPatterns = [
  'app/example/page.tsx',
  'masterStore.getTasks',
  'completed:',
  'completed)',
  'mock data',
  'Agent Smith',
];

for (const pattern of forbiddenPatterns) {
  if (content.includes(pattern)) {
    return Response.json(
      {
        error: `Proposal contains forbidden pattern: ${pattern}`,
        parsed,
      },
      { status: 500 }
    );
  }
}

// privalomas check
if (
  targetFile === 'app/execution/page.tsx' &&
  !content.includes('useMasterStore')
) {
  return Response.json(
    { error: 'Proposal does not use useMasterStore' },
    { status: 400 }
  );
}

    if (
      !parsed ||
      typeof parsed.summary !== 'string' ||
      typeof parsed.branchName !== 'string' ||
      typeof parsed.commitMessage !== 'string' ||
      !Array.isArray(parsed.changes)
    ) {
      return Response.json(
        {
          error: 'Invalid proposal shape',
          parsed,
        },
        { status: 500 }
      );
    }

    if (parsed.changes.length !== 1) {
      return Response.json(
        {
          error: 'Proposal must contain exactly one changed file',
          parsed,
        },
        { status: 500 }
      );
    }

    if (parsed.changes[0]?.filePath !== targetFile) {
      return Response.json(
        {
          error: `Model changed wrong file. Expected ${targetFile}, got ${parsed.changes[0]?.filePath}`,
          parsed,
        },
        { status: 500 }
      );
    }

    if (!parsed.branchName?.startsWith('agent/')) {
      parsed.branchName = buildBranchName(targetFile);
    }

    if (!parsed.commitMessage?.trim()) {
      parsed.commitMessage = buildCommitMessage(targetFile);
    }

    return Response.json(parsed);
  } catch (error) {
    console.error('PROPOSE_CHANGES_ERROR', error);

    const message =
      error instanceof Error ? error.message : 'Internal server error';

    return Response.json({ error: message }, { status: 500 });
  }
}