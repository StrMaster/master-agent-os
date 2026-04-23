'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse } from '@/lib/master-types';

// Helper function to detect intent based on user input
function detectIntent(text: string): MasterResponse['action'] {
  const lower = text.toLowerCase();

  // Explicit create commands for tasks
  const createTaskPhrases = ['sukurk task', 'create task', 'add task'];
  // Explicit create commands for agents
  const createAgentPhrases = ['sukurk agent', 'create agent'];

  // Question or mention phrases that should result in NONE
  const questionPhrases = ['ar turime', 'ar reikia', 'ar yra', 'ar galime', 'ar galima', 'ar yra', 'ar yra'];

  // Check for explicit create task commands
  for (const phrase of createTaskPhrases) {
    if (lower.includes(phrase)) {
      return {
        type: 'CREATE_TASK',
        payload: {
          title: text,
          priority: 'medium',
        },
      };
    }
  }

  // Check for explicit create agent commands
  for (const phrase of createAgentPhrases) {
    if (lower.includes(phrase)) {
      return {
        type: 'CREATE_AGENT',
        payload: {
          name: text,
          role: 'general',
        },
      };
    }
  }

  // Check for question or mention phrases
  for (const phrase of questionPhrases) {
    if (lower.includes(phrase)) {
      return {
        type: 'NONE',
      };
    }
  }

  // Default to NONE if no explicit command detected
  return {
    type: 'NONE',
  };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Expecting { messages: [{ role, content }, ...] }
    const messages = json.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json<MasterResponse>({
        message: 'Nėra pateiktų žinučių.',
        action: { type: 'NONE' },
      });
    }

    // Use the last user message content for intent detection
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

    if (!lastUserMessage) {
      return NextResponse.json<MasterResponse>({
        message: 'Nerasta vartotojo žinutė.',
        action: { type: 'NONE' },
      });
    }

    const content = lastUserMessage.content.trim();

    const action = detectIntent(content);

    let responseMessage = '';

    switch (action.type) {
      case 'CREATE_TASK':
        responseMessage = `Sukuriu užduotį: "${content}".`;
        break;
      case 'CREATE_AGENT':
        responseMessage = `Sukuriu agentą su aprašymu: "${content}".`;
        break;
      case 'NONE':
      default:
        responseMessage = 'Nerandu aiškios komandos. Prašome pateikti aiškų užsakymą.';
        break;
    }

    return NextResponse.json<MasterResponse>({
      message: responseMessage,
      action,
    });
  } catch (error) {
    return NextResponse.json<MasterResponse>({
      message: 'Įvyko klaida apdorojant užklausą.',
      action: { type: 'NONE' },
    });
  }
}
