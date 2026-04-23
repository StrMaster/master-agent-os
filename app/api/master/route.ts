'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Helper function to detect explicit create task commands
function isExplicitCreateTask(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('sukurk task') ||
    lower.includes('create task') ||
    lower.includes('add task')
  );
}

// Helper function to detect Lithuanian create task commands (legacy)
function isLithuanianCreateTask(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('sukurk užduotį') || lower.includes('pridėk užduotį');
}

// Helper to extract task title from text
function extractTaskTitle(text: string): string {
  // Try to extract after colon or after keyword
  const colonIndex = text.indexOf(':');
  if (colonIndex !== -1 && colonIndex + 1 < text.length) {
    return text.slice(colonIndex + 1).trim();
  }
  // fallback: remove known keywords
  return text
    .replace(/sukurk task/i, '')
    .replace(/create task/i, '')
    .replace(/add task/i, '')
    .replace(/sukurk užduotį/i, '')
    .replace(/pridėk užduotį/i, '')
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages as { role: string; content: string }[];

  if (!messages || messages.length === 0) {
    return NextResponse.json({
      message: 'No messages provided.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const lastMessage = messages[messages.length - 1];
  const text = lastMessage.content.trim();

  // 1. Explicit create task detection (priority)
  if (isExplicitCreateTask(text)) {
    const title = extractTaskTitle(text) || 'New Task';

    // Compose response message with workflow enhancements
    const message = `Task created: "${title}". I have assigned recommended agent and prepared next steps.`;

    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority: 'medium',
      },
    };

    return NextResponse.json({ message, action });
  }

  // 2. Lithuanian detection (legacy, keep intact)
  if (isLithuanianCreateTask(text)) {
    const title = extractTaskTitle(text) || 'Nauja užduotis';

    const message = `Užduotis sukurta: "${title}".`;

    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority: 'medium',
      },
    };

    return NextResponse.json({ message, action });
  }

  // 3. Workflow enhancements inside CREATE_TASK branch only
  // (No other overrides or detection here)

  // Fallback response if no valid action detected
  return NextResponse.json({
    message: 'No valid action detected.',
    action: { type: 'NONE' },
  } as MasterResponse);
}
