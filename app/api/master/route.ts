'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper function to detect question-like input
function isQuestion(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.endsWith('?')) return true;

  // Lithuanian pattern: starts with "Ar " (case insensitive)
  if (/^ar\s+/i.test(trimmed)) return true;

  // English patterns
  if (/^(do we|is there)\s+/i.test(trimmed)) return true;

  return false;
}

export async function POST(request: Request) {
  const json = await request.json();

  // Extract messages from request body
  const messages: { role: string; content: string }[] = json.messages || [];

  // Get last user message content
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const input = lastUserMessage?.content?.trim() ?? '';

  // Explicit command detection (create_task etc.) - keep existing behavior
  // For simplicity, detect create_task command by keywords
  // This is a placeholder for actual command detection logic

  // Example: if input contains "sukurk task" or "create task"
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('sukurk task') || lowerInput.includes('create task')) {
    // Extract title and priority from input - simplified
    // For demo, just create task with title = input and priority medium
    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title: input,
        priority: 'medium',
      },
    };

    const response: MasterResponse = {
      message: `Task sukurtas: "${input}".`,
      action,
    };

    return NextResponse.json(response);
  }

  // Question detection - must return NONE action with friendly message
  if (isQuestion(input)) {
    const action: MasterAction = {
      type: 'NONE',
      payload: {},
    };

    const response: MasterResponse = {
      message: 'Atpažinta klausimo forma. Naujas task ar agentas nebus kuriamas.',
      action,
    };

    return NextResponse.json(response);
  }

  // Fallback response for other inputs
  const action: MasterAction = {
    type: 'NONE',
    payload: {},
  };

  const response: MasterResponse = {
    message: 'No valid action detected.',
    action,
  };

  return NextResponse.json(response);
}
