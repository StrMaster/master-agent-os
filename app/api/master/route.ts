'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

// Helper to build subtasks based on task title
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

  if (lower.includes('api') || lower.includes('auth') || lower.includes('backend')) {
    return [
      'Define API endpoints',
      'Create request handlers',
      'Add validation and auth checks',
      'Handle errors and edge cases',
      'Test integration flow',
    ];
  }

  if (lower.includes('test') || lower.includes('qa') || lower.includes('validation')) {
    return [
      'Define test cases',
      'Cover happy path',
      'Cover edge cases',
      'Validate error states',
      'Document expected behavior',
    ];
  }

  return [
    'Define scope',
    'Create first UI version',
    'Connect core logic',
    'Test key flows',
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract messages from request
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Get last user message content
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    const content = lastUserMessage.content.toLowerCase();

    // Detect intent for create_task
    if (content.startsWith('sukurk task:') || content.startsWith('sukurk užduotį:') || content.startsWith('create task:')) {
      // Extract task title after the colon
      const colonIndex = lastUserMessage.content.indexOf(':');
      const rawTitle = colonIndex >= 0 ? lastUserMessage.content.slice(colonIndex + 1).trim() : 'New Task';

      // Clean title
      const title = rawTitle || 'New Task';

      // Build subtasks
      const subtasks = buildSubtasks(title);

      // Compose action with correct payload
      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority: 'medium',
        },
      };

      // Compose response message
      const message = `Task "${title}" created with ${subtasks.length} subtasks.`;

      // Return response
      return NextResponse.json({ message, action } as MasterResponse);
    }

    // Fallback: no recognized action
    const action: MasterAction = { type: 'NONE' };
    const message = 'No action recognized.';

    return NextResponse.json({ message, action } as MasterResponse);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
