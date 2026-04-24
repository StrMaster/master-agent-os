'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

// Deterministic command parsing for actions
function parseCommand(input: string): MasterAction {
  const lower = input.toLowerCase();

  if (lower.startsWith('sukurk task')) {
    // Example: "Sukurk task: sukurti login puslapi"
    const parts = input.split(':');
    const title = parts.length > 1 ? parts[1].trim() : input.trim();
    return {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority: 'medium',
      },
    };
  }

  if (lower.startsWith('sukurk agent')) {
    // Example: "Sukurk agent: frontend developer"
    const parts = input.split(':');
    const nameRole = parts.length > 1 ? parts[1].trim() : '';
    const [name, ...roleParts] = nameRole.split(' ');
    const role = roleParts.join(' ') || 'general';
    return {
      type: 'CREATE_AGENT',
      payload: {
        name: name || 'Agent',
        role,
      },
    };
  }

  if (lower.startsWith('atnaujink task status')) {
    // Example: "Atnaujink task status: taskId done"
    // Not implemented, fallback to NONE
    return { type: 'NONE' };
  }

  return { type: 'NONE' };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Accept either messages array or direct input string
    let input = '';

    if (Array.isArray(json.messages)) {
      // Use last user message content
      const lastUserMessage = [...json.messages].reverse().find((m) => m.role === 'user');
      input = lastUserMessage?.content || '';
    } else if (typeof json.input === 'string') {
      input = json.input;
    } else {
      input = json.prompt || '';
    }

    const action = parseCommand(input);

    let message = '';

    switch (action.type) {
      case 'CREATE_TASK':
        message = `Task "${action.payload.title}" sukurtas.`;
        break;
      case 'CREATE_AGENT':
        message = `Agentas "${action.payload.name}" su role "${action.payload.role}" sukurtas.`;
        break;
      case 'NONE':
      default:
        message = 'Nesuprantu komandos.';
        break;
    }

    const response: MasterResponse = {
      message,
      action,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: 'Klaida apdorojant užklausą.', action: { type: 'NONE' } },
      { status: 400 }
    );
  }
}
