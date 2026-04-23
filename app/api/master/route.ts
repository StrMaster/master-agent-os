'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messages: { role: string; content: string }[] = body.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content?.toLowerCase() || '';

    // Detect commands
    if (content.startsWith('sukurk task') || content.startsWith('sukurk užduotį') || content.startsWith('create task')) {
      // Extract title and priority
      const titleMatch = lastMessage.content.match(/sukurk task(?:ą|)?\s+(.*)/i) || lastMessage.content.match(/create task\s+(.*)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'New Task';

      // Default priority medium
      const priority = 'medium';

      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority,
        },
      };

      const message = `Task "${title}" sukurtas.`;

      const response: MasterResponse = {
        message,
        action,
      };

      return NextResponse.json(response);
    }

    if (content.startsWith('sukurk agent') || content.startsWith('create agent')) {
      // Extract name and role
      const nameMatch = lastMessage.content.match(/sukurk agent(?:ą|)?\s+(.*)/i) || lastMessage.content.match(/create agent\s+(.*)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'New Agent';

      // Default role general
      const role = 'general';

      const action: MasterAction = {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      };

      const message = `Agentas "${name}" sukurtas.`;

      const response: MasterResponse = {
        message,
        action,
      };

      return NextResponse.json(response);
    }

    // Question detection example
    if (content.includes('ar jau turime') || content.includes('do we have')) {
      const action: MasterAction = {
        type: 'NONE',
      };

      const message = 'Šiuo metu neturime atitinkamos informacijos.';

      const response: MasterResponse = {
        message,
        action,
      };

      return NextResponse.json(response);
    }

    // Fallback NONE
    const action: MasterAction = {
      type: 'NONE',
    };

    const message = 'Nesupratau komandos. Prašome pabandyti dar kartą.';

    const response: MasterResponse = {
      message,
      action,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      message: 'Įvyko klaida apdorojant užklausą.',
      action: { type: 'NONE' },
    });
  }
}
