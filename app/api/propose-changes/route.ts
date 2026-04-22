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

function isAllowedFile(filePath: string) {
  return (
    filePath.startsWith('app/') ||
    filePath.startsWith('lib/') ||
    filePath.startsWith('components/')
  );
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProposeBody;

    const prompt = String(body?.prompt ?? '').trim();
    const requestedTargetFile = String(body?.targetFile ?? '').trim();
    const targetFile = requestedTargetFile || '';

    if (!prompt) {
      return Response.json({ error: 'Missing prompt' }, { status: 400 });
    }

    if (targetFile && !isAllowedFile(targetFile)) {
      return Response.json(
        { error: `Blocked targetFile: ${targetFile}` },
        { status: 400 }
      );
    }

    const targetFileContent = targetFile
      ? await readProjectFile(targetFile)
      : null;

    if (targetFile && !targetFileContent) {
      return Response.json(
        { error: `Could not read target file: ${targetFile}` },
        { status: 400 }
      );
    }

    const masterStoreContent = await readProjectFile('lib/master-store.tsx');
    const masterTypesContent = await readProjectFile('lib/master-types.ts');
    const layoutContent = await readProjectFile('app/layout.tsx');
    const changesPageContent = await readProjectFile('app/changes/page.tsx');
    const executionPageContent = await readProjectFile('app/execution/page.tsx');
    const tasksPageContent = await readProjectFile('app/tasks/page.tsx');
    const chatPageContent = await readProjectFile('app/chat/page.tsx');

    const systemPrompt = `
You are a senior software engineer.

Return ONLY valid JSON.
Do NOT write explanations.
Do NOT write markdown.
Do NOT write code fences.

Format:
{
  "summary": "...",
  "branchName": "agent/...",
  "commitMessage": "feat: ...",
  "changes": [
    {
      "filePath": "...",
      "content": "FULL FILE CONTENT"
    }
  ]
}

YOUR JOB:
- If TARGET FILE is provided, modify ONLY that file
- If TARGET FILE is NOT provided, choose the single most relevant file
- Preserve the existing project architecture
- Use the existing store/types APIs exactly as provided
- Return the FULL updated file content, not a diff

STRICT RULES:
- DO NOT create new files
- DO NOT rename files
- DO NOT modify more than one file
- DO NOT invent new APIs
- DO NOT invent new store methods
- DO NOT replace real logic with mock data
- DO NOT return example/demo files
- DO NOT use app/example/page.tsx
- DO NOT use masterStore.getTasks
- Use subtasks.done, never completed

IMPORTANT:
- changes must contain EXACTLY ONE item
- changes[0].filePath must be an allowed file under app/, lib/, or components/
- If editing app/execution/page.tsx, the result must keep using useMasterStore from '@/lib/master-store'
- If editing UI-only files, keep business logic intact
`.trim();

    const userPrompt = `
USER REQUEST:
${prompt}

${targetFile ? `TARGET FILE: ${targetFile}` : 'TARGET FILE: auto-select the single most relevant file'}

${targetFileContent ? `CURRENT TARGET FILE CONTENT:
<<FILE>>
${targetFileContent}
<<END FILE>>` : ''}

RELEVANT PROJECT CONTEXT:
lib/master-store.tsx
<<FILE>>
${masterStoreContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
lib/master-types.ts
<<FILE>>
${masterTypesContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
app/layout.tsx
<<FILE>>
${layoutContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
app/changes/page.tsx
<<FILE>>
${changesPageContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
app/execution/page.tsx
<<FILE>>
${executionPageContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
app/tasks/page.tsx
<<FILE>>
${tasksPageContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

RELEVANT PROJECT CONTEXT:
app/chat/page.tsx
<<FILE>>
${chatPageContent ?? 'FILE NOT AVAILABLE'}
<<END FILE>>

OUTPUT REQUIREMENTS:
- modify only one file
- if target file is provided, that exact file must be used
- if target file is not provided, choose the best single file
- use the real project store/types
- return valid JSON only
`.trim();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
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
      !Array.isArray(parsed.changes) ||
      parsed.changes.length !== 1
    ) {
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

    if (
      changedFile === 'app/execution/page.tsx' &&
      !changedContent.includes("useMasterStore")
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