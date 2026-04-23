'use server';

import { NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

// Helper function to clean and format title
function cleanTitle(title: string): string {
  // Remove leading command phrases
  let cleaned = title.trim();

  // Remove 'Sukurk task:' or 'Sukurk užduotį:' prefix (case insensitive)
  cleaned = cleaned.replace(/^sukurk\s+(task|užduotį):?/i, '').trim();

  // Capitalize first letter and lowercase rest
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  return cleaned;
}

export async function POST(request: Request) {
  const body = await request.json();

  const messages = body.messages as { role: string; content: string }[] | undefined;

  if (!messages || messages.length === 0) {
    return NextResponse.json({
      message: 'No messages provided.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  if (!lastUserMessage) {
    return NextResponse.json({
      message: 'No user message found.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const content = lastUserMessage.content.trim();

  // Detect create task intent - keep original condition intact
  if (/^sukurk\s+(task|užduotį):?/i.test(content)) {
    // Clean and format title
    const cleanedTitle = cleanTitle(content);

    // Compose description
    const description = `Task created with title: "${cleanedTitle}". Please prioritize accordingly.`;

    return NextResponse.json({
      message: `Task created: ${cleanedTitle}`,
      action: {
        type: 'CREATE_TASK',
        payload: {
          title: cleanedTitle,
          priority: 'medium',
        },
      },
    } as MasterResponse);
  }

  // Other intents can be handled here

  return NextResponse.json({
    message: 'No recognized action.',
    action: { type: 'NONE' },
  } as MasterResponse);
}
