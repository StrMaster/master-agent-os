import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4.1-mini';

function normalize(str: string) {
  return str.replace(/\r\n/g, '\n');
}

function extractJson(text: string) {
  const clean = text.replace(/```json/g, '').replace(/```/g, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  return clean.slice(start, end + 1);
}

function safeParse(text: string) {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    throw new Error('Invalid JSON from model');
  }
}

function applyReplace(original: string, find: string, replace: string) {
  const count = original.split(find).length - 1;

  if (count === 1) {
    return original.replace(find, replace);
  }

  if (count > 1) {
    throw new Error(`Find not unique (${count})`);
  }

  throw new Error('Find not found');
}

function validate(content: string) {
  const errors: string[] = [];

  const open = (content.match(/<div(\s|>)/g) || []).length;
  const close = (content.match(/<\/div>/g) || []).length;

  if (open !== close) {
    errors.push('JSX mismatch');
  }

  const blocks =
    content.match(/completedTasks\.length === 0[\s\S]*?\)/g) || [];

  if (blocks.length > 1) {
    errors.push('Duplicate empty state');
  }

  return errors;
}

export async function POST(req: Request) {
  try {
    const { prompt, filePath, original } = await req.json();

    const system = `
Return STRICT JSON.

Rules:
- EXACTLY one change
- multi-line find (3-6 lines)
- find must be UNIQUE
- do not duplicate UI
- valid JSX
`;

    const user = `
TASK:
${prompt}

FILE:
${original.slice(0, 8000)}
`;

    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    let parsed = safeParse(res.choices[0].message?.content || '');

    let change = parsed.changes[0];

    let updated = applyReplace(original, change.find, change.replace);

    let errors = validate(updated);

    if (errors.length > 0) {
      const retry = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `
Fix validation errors:

${errors.join('\n')}

${prompt}
`,
          },
        ],
      });

      parsed = safeParse(retry.choices[0].message?.content || '');
      change = parsed.changes[0];
      updated = applyReplace(original, change.find, change.replace);
    }

    if (updated === original) {
      return Response.json({ message: 'No changes needed' });
    }

    return Response.json({
      changes: [
        {
          filePath,
          content: updated,
          originalContent: original,
        },
      ],
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message, buildError: e.message },
      { status: 500 }
    );
  }
}