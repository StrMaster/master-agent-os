import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { MasterResponse } from '@/lib/master-types';

type Priority = 'low' | 'medium' | 'high';
type ActionType = 'CREATE_TASK' | 'CREATE_AGENT' | 'NONE';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

console.log('API KEY EXISTS:', !!process.env.OPENAI_API_KEY);

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ');
}

function none(message: string): MasterResponse {
  return {
    message,
    action: { type: 'NONE', payload: {} },
  } as MasterResponse;
}

function createTaskResponse(title: string, priority: Priority = 'medium'): MasterResponse {
  const cleanTitle = title.trim().replace(/^[:\s]+/, '');

  if (!cleanTitle) {
    return none('Task pavadinimas negali būti tuščias.');
  }

  return {
    message: `Task "${cleanTitle}" sukurtas.`,
    action: {
      type: 'CREATE_TASK',
      payload: {
        title: cleanTitle,
        priority,
      },
    },
  } as MasterResponse;
}

function createAgentResponse(role: string, name: string): MasterResponse {
  const cleanRole = role.trim() || 'general';
  const cleanName = name.trim();

  if (!cleanName || cleanName.toLowerCase() === 'agent') {
    return none('Agento vardas negali būti tuščias.');
  }

  return {
    message: `Agentas "${cleanName}" su role "${cleanRole}" sukurtas.`,
    action: {
      type: 'CREATE_AGENT',
      payload: {
        name: cleanName,
        role: cleanRole,
      },
    },
  } as MasterResponse;
}

function parseByRules(input: string): MasterResponse | null {
  const text = normalizeInput(input);

  const taskMatch = text.match(/^(sukurk|create|add)\s+task[:\s]+(.+)$/i);
  if (taskMatch) {
    return createTaskResponse(taskMatch[2], 'medium');
  }

  if (/^(sukurk|create|add)\s+task[:\s]*$/i.test(text)) {
    return none('Task pavadinimas negali būti tuščias.');
  }

  const agentMatch = text.match(/^(sukurk|create|add)\s+agent(?:ą)?\s+(\S+)\s+(.+)$/i);
  if (agentMatch) {
    return createAgentResponse(agentMatch[2], agentMatch[3]);
  }

  if (/^(sukurk|create|add)\s+agent(?:ą)?\s*$/i.test(text)) {
    return none('Agento vardas negali būti tuščias.');
  }

  return null;
}

function extractJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function validateLLMResponse(value: unknown): MasterResponse | null {
  if (!value || typeof value !== 'object') return null;

  const obj = value as {
    message?: unknown;
    action?: {
      type?: unknown;
      payload?: Record<string, unknown>;
    };
  };

  if (typeof obj.message !== 'string') return null;
  if (!obj.action || typeof obj.action.type !== 'string') return null;

  const type = obj.action.type as ActionType;

  if (type === 'CREATE_TASK') {
    const title = obj.action.payload?.title;

    if (typeof title !== 'string' || title.trim().length < 2) {
      return none('LLM pasiūlė task, bet pavadinimas netinkamas.');
    }

    const rawPriority = obj.action.payload?.priority;
    const priority: Priority =
      rawPriority === 'low' || rawPriority === 'medium' || rawPriority === 'high'
        ? rawPriority
        : 'medium';

    return createTaskResponse(title, priority);
  }

  if (type === 'CREATE_AGENT') {
    const name = obj.action.payload?.name;
    const role = obj.action.payload?.role;

    if (typeof name !== 'string' || name.trim().length < 2) {
      return none('LLM pasiūlė agentą, bet vardas netinkamas.');
    }

    return createAgentResponse(typeof role === 'string' ? role : 'general', name);
  }

  return none(obj.message || 'Veiksmas neatpažintas. Nieko nekeičiu.');
}

async function interpretWithLLM(input: string): Promise<MasterResponse | null> {
  console.log('--- LLM START ---');
  console.log('INPUT:', input);

  if (!openai) {
    console.log('LLM SKIPPED: missing OPENAI_API_KEY');
    return null;
  }

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            'You are Master Agent.',
            'Return ONLY valid JSON. No markdown.',
            'Allowed action.type values: CREATE_TASK, CREATE_AGENT, NONE.',
            'CREATE_TASK payload must include title and optional priority: low, medium, high.',
            'CREATE_AGENT payload must include name and optional role.',
            'If user asks informational questions, return NONE.',
            'If user says something like "gal padarom", "reikia", "padaryk", "sukurk kažką" and it sounds like work to do, return CREATE_TASK.',
            'Never return unsupported actions.',
          ].join(' '),
        },
        {
          role: 'user',
          content: input,
        },
      ],
    });

    console.log('RAW RESPONSE:', JSON.stringify(response, null, 2));

    let text = response.output_text?.trim();

    if (!text && Array.isArray(response.output)) {
      const first = response.output[0];

      if (first && 'content' in first && Array.isArray(first.content)) {
        const content = first.content[0];

        if (content && 'text' in content && typeof content.text === 'string') {
          text = content.text.trim();
        }
      }
    }

    console.log('TEXT:', text);

    if (!text) return null;

    const parsed = extractJson(text);
    console.log('PARSED:', parsed);

    if (!parsed) return null;

    return validateLLMResponse(parsed);
  } catch (error) {
    console.error('LLM ERROR:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(none('Nėra pateiktų žinučių.'));
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message?.role === 'user');

    const content =
      typeof lastUserMessage?.content === 'string'
        ? lastUserMessage.content
        : '';

    if (!content.trim()) {
      return NextResponse.json(none('Tuščia vartotojo žinutė.'));
    }

    const ruleResult = parseByRules(content);
    if (ruleResult) {
      return NextResponse.json(ruleResult);
    }

    const llmResult = await interpretWithLLM(content);
    if (llmResult) {
      return NextResponse.json(llmResult);
    }

    return NextResponse.json(
      none("Nesupratau komandos. Pabandyk: 'Sukurk task: login page'")
    );
  } catch (error) {
    console.error('MASTER API ERROR:', error);

    return NextResponse.json(
      none('Įvyko klaida apdorojant užklausą. Nieko nekeičiu.'),
      { status: 200 }
    );
  }
}
