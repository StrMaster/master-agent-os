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

function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
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
    const messagesRaw = Array.isArray(body?.messages) ? body.messages : [];
    const conversation: IncomingMessage[] = messagesRaw.filter(isIncomingMessage);

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
- jei vartotojas prašo sukurti task, visada grąžinti CREATE_TASK
- jei vartotojas prašo sukurti agentą, visada grąžinti CREATE_AGENT
- jei vartotojas prašo kažką siųsti vykdymui, visada grąžinti SEND_TO_EXECUTION
- NONE naudok tik tada, kai tikrai nėra jokio veiksmo

KRITINĖ TAISYKLĖ:
- jei vartotojo žinutėje yra "task", tai reiškia užduoties sukūrimą
- tokiu atveju NEGALIMA generuoti šablono, kodo, HTML, React komponento ar pilno sprendimo
- turi būti grąžintas CREATE_TASK action
- pavyzdys: "sukurk task login page" reiškia užduotį pavadinimu "Login page", o ne login page kodo generavimą

SVARBI TAISYKLĖ:
- NIEKADA neklausk patikslinimų
- jei informacijos trūksta, pats priimk protingą numatytą sprendimą
- jei nėra priority, naudok "medium"
- jei nėra agent role, naudok "general"
- jei nėra aišku ką siųsti vykdymui, naudok paskutinį sukurtą tinkamą objektą

Privalai grąžinti TIK validų JSON šiuo formatu:

{
  "message": "tekstas vartotojui",
  "action": {
    "type": "CREATE_TASK" | "CREATE_AGENT" | "SEND_TO_EXECUTION" | "NONE",
    "payload": {}
  }
}

CREATE_TASK payload:
{
  "title": "string",
  "priority": "low" | "medium" | "high"
}

CREATE_AGENT payload:
{
  "name": "string",
  "role": "string"
}

SEND_TO_EXECUTION payload:
{
  "targetType": "task" | "agent",
  "targetId": "string optional",
  "note": "string optional"
}

Pavyzdžiai:

Jei vartotojas rašo:
"sukurk task login page"

Grąžink:
{
  "message": "Sukūriau task login page.",
  "action": {
    "type": "CREATE_TASK",
    "payload": {
      "title": "Login page",
      "priority": "medium"
    }
  }
}

Jei vartotojas rašo:
"sukurk agentą frontend darbams"

Grąžink:
{
  "message": "Sukūriau agentą frontend darbams.",
  "action": {
    "type": "CREATE_AGENT",
    "payload": {
      "name": "Frontend Agent",
      "role": "frontend"
    }
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

    const lastUserMessage =
      conversation
        .filter((m) => m.role === 'user')
        .at(-1)
        ?.content.toLowerCase() ?? '';

    // Hard fallback: jei vartotojas mini "task", visada kuriam task
    if (lastUserMessage.includes('task')) {
      const cleanedTitle =
        lastUserMessage
          .replace('sukurk', '')
          .replace('task', '')
          .replace(':', '')
          .trim() || 'Naujas task';

      parsed.action = {
        type: 'CREATE_TASK',
        payload: {
          title: cleanedTitle
            .split(' ')
            .map((word) =>
              word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word
            )
            .join(' '),
          priority: 'medium',
        },
      };

      parsed.message = `Sukūriau task: ${parsed.action.payload.title}.`;
    } else if (lastUserMessage.includes('agent')) {
      parsed.action = {
        type: 'CREATE_AGENT',
        payload: {
          name: 'Naujas Agentas',
          role: 'general',
        },
      };

      parsed.message = 'Sukūriau naują agentą.';
    } else if (
      lastUserMessage.includes('vykdym') ||
      lastUserMessage.includes('execution')
    ) {
      parsed.action = {
        type: 'SEND_TO_EXECUTION',
        payload: {
          targetType: 'task',
          note: 'Siunčiu paskutinį tinkamą objektą vykdymui.',
        },
      };

      parsed.message = 'Išsiunčiau į vykdymą.';
    }

    return Response.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';

    const safeMessage = message.includes('quota')
      ? 'OpenAI quota exceeded. Patikrink billing.'
      : message.includes('Incorrect API key')
      ? 'Neteisingas OpenAI API raktas.'
      : 'Įvyko serverio klaida.';

    return Response.json(
      {
        message: safeMessage,
        action: { type: 'NONE', payload: {} },
      },
      { status: 500 }
    );
  }
}