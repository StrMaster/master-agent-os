import OpenAI from 'openai';
import { MasterResponse } from '@/lib/master-types';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type IncomingMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Intent = 'CREATE_TASK' | 'CREATE_AGENT' | 'SEND_TO_EXECUTION' | 'NONE';

function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;

  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

function buildSubtasks(taskTitle: string): string[] {
  const lower = taskTitle.toLowerCase();

  if (lower.includes('login')) {
    return [
      'Create login page layout',
      'Add email and password inputs',
      'Add validation states',
      'Connect authentication flow',
      'Add loading and error handling',
    ];
  }

  if (lower.includes('dashboard')) {
    return [
      'Create dashboard layout',
      'Add summary cards',
      'Connect shared data source',
      'Add responsive behavior',
      'Polish visual hierarchy',
    ];
  }

  if (lower.includes('mobile') || lower.includes('navigation') || lower.includes('sidebar')) {
    return [
      'Analyze current mobile layout issues',
      'Fix sidebar visibility and toggle behavior',
      'Prevent horizontal overflow',
      'Improve responsive layout and spacing',
    ];
  }

  if (lower.includes('agent')) {
    return [
      'Define agent role',
      'Define agent inputs and outputs',
      'Add status handling',
      'Connect agent to execution flow',
    ];
  }

  return [
    'Define scope',
    'Create first UI version',
    'Connect core logic',
    'Test key flows',
  ];
}

function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();

  if (!t) return false;
  if (t.endsWith('?')) return true;

  return (
    t.startsWith('ar ') ||
    t.startsWith('ar jau ') ||
    t.startsWith('ar turime ') ||
    t.startsWith('do we ') ||
    t.startsWith('is there ') ||
    t.startsWith('should we ')
  );
}

function detectIntent(text: string): Intent {
  const t = text.trim().toLowerCase();

  if (!t) return 'NONE';
  if (isQuestion(t)) return 'NONE';

  if (
    t.includes('sukurk task') ||
    t.includes('sukurk naują task') ||
    t.includes('create task') ||
    t.includes('add task')
  ) {
    return 'CREATE_TASK';
  }

  if (
    t.includes('sukurk agent') ||
    t.includes('sukurk agentą') ||
    t.includes('create agent') ||
    t.includes('add agent')
  ) {
    return 'CREATE_AGENT';
  }

  if (
    t.includes('vykdym') ||
    t.includes('execution') ||
    t.includes('send to execution') ||
    t.includes('siųsk į vykdymą')
  ) {
    return 'SEND_TO_EXECUTION';
  }

  return 'NONE';
}

function normalizeTaskTitle(rawText: string): string {
  let cleaned = rawText.trim();

  cleaned = cleaned.replace(/^sukurk\s+naują\s+task[:\s-]*/i, '');
  cleaned = cleaned.replace(/^sukurk\s+task[:\s-]*/i, '');
  cleaned = cleaned.replace(/^create\s+task[:\s-]*/i, '');
  cleaned = cleaned.replace(/^add\s+task[:\s-]*/i, '');

  cleaned = cleaned.trim();

  if (!cleaned) return 'New Task';

  const lower = cleaned.toLowerCase();

  const dictionary: Array<[RegExp, string]> = [
    [/^pagerinti mobile navigation$/i, 'Improve mobile navigation'],
    [/^pagerinti mobile navigaciją$/i, 'Improve mobile navigation'],
    [/^pagerinti ui$/i, 'Improve UI'],
    [/^pagerinti mobile ui$/i, 'Improve mobile UI'],
    [/^sutvarkyti mobile navigation$/i, 'Fix mobile navigation'],
    [/^sutvarkyti mobile ui$/i, 'Fix mobile UI'],
    [/^login page$/i, 'Login page'],
    [/^dashboard$/i, 'Dashboard'],
  ];

  for (const [pattern, replacement] of dictionary) {
    if (pattern.test(cleaned)) return replacement;
  }

  return lower
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

function normalizeAgentName(rawText: string): string {
  let cleaned = rawText.trim();

  cleaned = cleaned.replace(/^sukurk\s+agentą[:\s-]*/i, '');
  cleaned = cleaned.replace(/^sukurk\s+agent[:\s-]*/i, '');
  cleaned = cleaned.replace(/^create\s+agent[:\s-]*/i, '');
  cleaned = cleaned.replace(/^add\s+agent[:\s-]*/i, '');

  cleaned = cleaned.trim();

  if (!cleaned) return 'General Agent';

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferPriority(taskTitle: string): 'low' | 'medium' | 'high' {
  const lower = taskTitle.toLowerCase();

  if (
    lower.includes('fix') ||
    lower.includes('bug') ||
    lower.includes('error') ||
    lower.includes('mobile') ||
    lower.includes('navigation') ||
    lower.includes('overflow') ||
    lower.includes('sidebar')
  ) {
    return 'high';
  }

  if (lower.includes('improve') || lower.includes('enhance') || lower.includes('ui')) {
    return 'medium';
  }

  return 'medium';
}

function normalizeParsedResponse(raw: string): MasterResponse {
  try {
    const candidate = JSON.parse(raw) as Partial<MasterResponse>;

    return {
      message:
        typeof candidate.message === 'string' && candidate.message.trim()
          ? candidate.message
          : 'Užduotis apdorota.',
      action:
        candidate.action &&
        typeof candidate.action === 'object' &&
        'type' in candidate.action
          ? (candidate.action as MasterResponse['action'])
          : { type: 'NONE', payload: {} },
    };
  } catch {
    return {
      message: raw || 'Nepavyko sugeneruoti atsakymo.',
      action: { type: 'NONE', payload: {} },
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // EXECUTION MODE
    if (body.mode === 'execute-subtask') {
      const subtask = body.subtask;

      const completion = await client.responses.create({
        model: 'gpt-4.1-mini',
        input: `
Tu esi agentas vykdantis užduotis.

Subtask: "${subtask}"

Atsakyk JSON formatu:
{ "done": true, "note": "trumpa pastaba" }
        `.trim(),
      });

      return new Response(
        JSON.stringify({
          result: completion.output_text,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const messagesRaw = Array.isArray(body?.messages) ? body.messages : [];
    const conversation: IncomingMessage[] = messagesRaw.filter(isIncomingMessage);

    const lastUserMessage =
      conversation.filter((m) => m.role === 'user').at(-1)?.content?.trim() ?? '';

    if (!lastUserMessage) {
      return Response.json({
        message: 'Nėra pateiktos vartotojo užklausos.',
        action: { type: 'NONE', payload: {} },
      } satisfies MasterResponse);
    }

    const detectedIntent = detectIntent(lastUserMessage);

    if (detectedIntent === 'NONE') {
      return Response.json({
        message: 'Atpažinta informacinė arba klausimo forma. Naujas task ar agentas nebus kuriamas.',
        action: { type: 'NONE', payload: {} },
      } satisfies MasterResponse);
    }

    if (detectedIntent === 'CREATE_TASK') {
      const title = normalizeTaskTitle(lastUserMessage);
      const priority = inferPriority(title);
      const subtasks = buildSubtasks(title);

      return Response.json({
        message: `Task "${title}" created with ${subtasks.length} subtasks.`,
        action: {
          type: 'CREATE_TASK',
          payload: {
            title,
            priority,
            subtasks,
          },
        },
      } satisfies MasterResponse);
    }

    if (detectedIntent === 'CREATE_AGENT') {
      const name = normalizeAgentName(lastUserMessage);

      return Response.json({
        message: `Agent "${name}" created.`,
        action: {
          type: 'CREATE_AGENT',
          payload: {
            name,
            role: 'general',
          },
        },
      } satisfies MasterResponse);
    }

    if (detectedIntent === 'SEND_TO_EXECUTION') {
      return Response.json({
        message: 'Išsiunčiau į vykdymą.',
        action: {
          type: 'SEND_TO_EXECUTION',
          payload: {
            targetType: 'task',
            note: 'Siunčiu paskutinį tinkamą objektą vykdymui.',
          },
        },
      } satisfies MasterResponse);
    }

    const inputText = conversation
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `
Tu esi Master Agent OS branduolys.

Tavo tikslas:
- veikti, o ne klausti
- atsakyti trumpai, aiškiai ir praktiškai

Privalai grąžinti TIK validų JSON šiuo formatu:
{
  "message": "tekstas vartotojui",
  "action": {
    "type": "CREATE_TASK" | "CREATE_AGENT" | "SEND_TO_EXECUTION" | "NONE",
    "payload": {}
  }
}
          `.trim(),
        },
        {
          role: 'user',
          content: inputText || 'USER: Labas',
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = normalizeParsedResponse(raw);

    return Response.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    const safeMessage = message.includes('quota')
      ? 'OpenAI quota exceeded. Patikrink billing.'
      : message.includes('Incorrect API key')
      ? 'Neteisingas OpenAI API raktas.'
      : 'Įvyko serverio klaida.';

    return Response.json(
      {
        message: safeMessage,
        action: { type: 'NONE', payload: {} },
      } satisfies MasterResponse,
      { status: 500 }
    );
  }
}