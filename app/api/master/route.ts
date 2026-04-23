'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper to clean task title from user prompt
function extractTaskTitle(raw: string): string {
  const prefixes = [
    'sukurk task',
    'sukurk naują task',
    'create task',
    'add task',
  ];

  let cleaned = raw.toLowerCase();
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
      // Remove leading colon or dash if present
      if (cleaned.startsWith(':') || cleaned.startsWith('-')) {
        cleaned = cleaned.slice(1).trim();
      }
      break;
    }
  }

  // Capitalize first letter for nicer title
  if (cleaned.length > 0) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  return cleaned || 'New Task';
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Expecting { messages: { role: string; content: string }[] }
    const messages = json.messages;
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { message: 'Invalid request: missing messages array', action: { type: 'NONE' } },
        { status: 400 }
      );
    }

    // Get last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return NextResponse.json(
        { message: 'No user message found', action: { type: 'NONE' } },
        { status: 400 }
      );
    }

    const content = lastUserMessage.content.trim();
    const lowerContent = content.toLowerCase();

    // Check if user explicitly requests to create a task
    const createTaskPrefixes = [
      'sukurk task',
      'sukurk naują task',
      'create task',
      'add task',
    ];

    const isCreateTask = createTaskPrefixes.some((prefix) => lowerContent.startsWith(prefix));

    if (isCreateTask) {
      const title = extractTaskTitle(content);

      // Compose concise structured response
      const response: MasterResponse = {
        message: `Task created: ${title}`,
        action: {
          type: 'CREATE_TASK',
          payload: {
            title,
            priority: 'medium',
          },
        },
      };

      return NextResponse.json(response);
    }

    // Default fallback response
    const response: MasterResponse = {
      message: "I'm here to help. You can ask me to create tasks or agents.",
      action: { type: 'NONE' },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error', action: { type: 'NONE' } },
      { status: 500 }
    );
  }
}
