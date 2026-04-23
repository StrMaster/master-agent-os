'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Since this is a server route, we cannot use React hooks directly.
// Instead, we will simulate the logic inline for stable runtime.

// Helper to build default response
function buildResponse(message: string, action: MasterAction): MasterResponse {
  return { message, action };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Handle create_task mode
    if (json.mode === 'create_task' && json.title && json.priority) {
      // Return the same response shape the frontend expects
      // Action type CREATE_TASK with payload title and priority
      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title: json.title,
          priority: json.priority,
        },
      };

      const message = `Task "${json.title}" created with priority ${json.priority}.`;

      return NextResponse.json(buildResponse(message, action));
    }

    // Handle intent detection from messages
    if (Array.isArray(json.messages)) {
      // Basic intent detection based on last user message content
      const lastMessage = json.messages[json.messages.length - 1];
      const content = (lastMessage?.content || '').toLowerCase();

      // Default action
      let action: MasterAction = { type: 'NONE' };
      let message = 'Aš nesupratau jūsų užklausos.';

      if (content.includes('kurk task') || content.includes('sukurk task')) {
        // Extract title and priority from content if possible
        // For stability, fallback to defaults
        const titleMatch = content.match(/task ([\w\s]+)/);
        const title = titleMatch ? titleMatch[1].trim() : 'New Task';
        const priority = content.includes('aukštas') || content.includes('high') ? 'high' : 'medium';

        action = {
          type: 'CREATE_TASK',
          payload: {
            title,
            priority: priority as 'low' | 'medium' | 'high',
          },
        };

        message = `Sukūriau užduotį: "${title}" su prioritetu ${priority}.`;
      } else if (content.includes('kurk agent') || content.includes('sukurk agent')) {
        // Extract name and role
        const nameMatch = content.match(/agentą ([\w\s]+)/);
        const roleMatch = content.match(/role ([\w]+)/);
        const name = nameMatch ? nameMatch[1].trim() : 'New Agent';
        const role = roleMatch ? roleMatch[1].trim() : 'general';

        action = {
          type: 'CREATE_AGENT',
          payload: {
            name,
            role,
          },
        };

        message = `Sukūriau agentą: "${name}" su role ${role}.`;
      } else {
        // Default fallback
        action = { type: 'NONE' };
        message = 'Prašome pateikti aiškesnę užklausą.';
      }

      return NextResponse.json(buildResponse(message, action));
    }

    // If no recognized input, return default
    return NextResponse.json(buildResponse('Nepažįstama užklausa.', { type: 'NONE' }));
  } catch (error) {
    // On error, return a safe response
    return NextResponse.json(
      buildResponse('Įvyko klaida apdorojant užklausą.', { type: 'NONE' })
    );
  }
}
