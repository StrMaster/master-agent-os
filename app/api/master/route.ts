'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Helper function to normalize Lithuanian task titles to English
function normalizeTaskTitle(rawTitle: string): string {
  const mapping: Record<string, string> = {
    'pagerinti mobile navigation': 'Improve mobile navigation',
    // Add more mappings here if needed
  };

  const lower = rawTitle.trim().toLowerCase();
  if (mapping[lower]) {
    return mapping[lower];
  }

  // Fallback: capitalize first letter of each word
  return rawTitle
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function POST(req: NextRequest) {
  const json = await req.json();

  // Expecting messages array in the body
  const messages = json.messages as { role: string; content: string }[] | undefined;

  if (!messages || messages.length === 0) {
    return NextResponse.json({
      message: 'No messages provided',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return NextResponse.json({
      message: 'No user message found',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const content = lastUserMessage.content.trim();

  // Detect create task intent
  // Example user input: "Sukurk task: pagerinti mobile navigation"
  const createTaskMatch = content.match(/sukurk task:?\s*(.+)/i);

  if (createTaskMatch) {
    const rawTitle = createTaskMatch[1].trim();
    const normalizedTitle = normalizeTaskTitle(rawTitle);

    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title: normalizedTitle,
        priority: 'medium',
      },
    };

    const message = `Task created: ${normalizedTitle}`;

    return NextResponse.json({ message, action } as MasterResponse);
  }

  // Default fallback response
  return NextResponse.json({
    message: "Nesuprantu užklausos.",
    action: { type: 'NONE' },
  } as MasterResponse);
}
