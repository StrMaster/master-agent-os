'use server';

import { NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper function to translate Lithuanian to English for known phrases
function translateLithuanianToEnglish(text: string): string {
  const translations: { [key: string]: string } = {
    'pagerinti mobile navigation': 'Improve mobile navigation',
    'sukurti task': 'Create task',
    'sukurk task': 'Create task',
    'pridėti task': 'Add task',
    'prideti task': 'Add task',
    'sukurti agentą': 'Create agent',
    'sukurk agentą': 'Create agent',
    'pridėti agentą': 'Add agent',
    'prideti agenta': 'Add agent',
    // Add more translations as needed
  };

  const lower = text.toLowerCase();
  for (const key in translations) {
    if (lower.includes(key)) {
      return translations[key];
    }
  }
  return text;
}

// Remove prefixes and clean title
function cleanTitle(rawTitle: string): string {
  let title = rawTitle.trim();

  // Remove prefixes
  const prefixes = ['task:', 'sukurk task', 'create task', 'add task'];
  for (const prefix of prefixes) {
    if (title.toLowerCase().startsWith(prefix)) {
      title = title.slice(prefix.length).trim();
      break;
    }
  }

  // Translate Lithuanian to English if needed
  title = translateLithuanianToEnglish(title);

  // Sentence case capitalization
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
  }

  return title;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Example: expecting { action: 'CREATE_TASK', payload: { title: string, priority: string } }
    if (body.action === 'CREATE_TASK' && body.payload && typeof body.payload.title === 'string') {
      const cleanedTitle = cleanTitle(body.payload.title);

      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title: cleanedTitle,
          priority: body.payload.priority || 'medium',
        },
      };

      const response: MasterResponse = {
        message: `Task created:\n\nTitle: ${cleanedTitle}\n\nDescription:\n- Fix mobile sidebar behavior\n- Prevent horizontal overflow\n- Improve responsive layout`,
        action,
      };

      return NextResponse.json(response);
    }

    // For other actions, just echo back or handle accordingly
    return NextResponse.json({ message: 'Action not supported', action: { type: 'NONE' } });
  } catch (error) {
    return NextResponse.json({ message: 'Invalid request', action: { type: 'NONE' } }, { status: 400 });
  }
}
