import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = 'StrMaster';
const REPO = 'master-agent-os';
const FILE_PATH = '.agent/tasks.json';

async function getFile() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      cache: 'no-store',
    }
  );

  return res.json();
}

export async function GET() {
  const file = await getFile();
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  return NextResponse.json(JSON.parse(content));
}

export async function POST(req: Request) {
  const newTask = await req.json();

  const file = await getFile();
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  const tasks = JSON.parse(content);

  const updated = [...tasks, newTask];

  const encoded = Buffer.from(JSON.stringify(updated, null, 2)).toString(
    'base64'
  );

  await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'update tasks',
        content: encoded,
        sha: file.sha,
      }),
    }
  );

  return NextResponse.json({ ok: true });
}
