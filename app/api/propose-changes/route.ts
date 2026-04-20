import OpenAI from 'openai';
import { ChangeProposal } from '@/lib/github-types';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt ?? '').trim();

    if (!prompt) {
      return Response.json(
        { error: 'Missing prompt' },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `
Tu esi coding change planner.

Tavo tikslas:
- pagal vartotojo užduotį pasiūlyti failų pakeitimus Next.js projekte
- grąžinti TIK validų JSON

JSON formatas:
{
  "summary": "trumpas ką pakeitei",
  "branchName": "agent/...",
  "commitMessage": "feat: ...",
  "changes": [
    {
      "filePath": "app/example/page.tsx",
      "content": "pilnas failo turinys"
    }
  ]
}

Taisyklės:
- grąžink pilną failo turinį, ne diff
- keisk tik app/, lib/, components/ failus
- nekeisk .env, package-lock, node_modules, vercel config
- branchName turi būti trumpas, lowercase, su brūkšneliais
          `.trim(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    let parsed: ChangeProposal;

    try {
      parsed = JSON.parse(raw) as ChangeProposal;
    } catch {
      return Response.json(
        { error: 'Model returned invalid JSON', raw },
        { status: 500 }
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
        { error: 'Invalid proposal shape', parsed },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';

    return Response.json({ error: message }, { status: 500 });
  }
}