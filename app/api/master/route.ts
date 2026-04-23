'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Removed import of useMasterStore because it is a React hook and cannot be used in API route

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // We do not have access to store state here, so we cannot check agents or tasks
    // We keep create_task and create_agent working by returning appropriate actions

    // Detect if this is a chat message request with messages array
    if (body.messages && Array.isArray(body.messages)) {
      const lastMessage = body.messages[body.messages.length - 1];
      const content = lastMessage.content.toLowerCase();

      // Simple detection for creating task
      if (content.includes('sukurk task') || content.includes('create task')) {
        // Extract title from message (naive)
        const titleMatch = content.match(/sukurk task: (.+)/) || content.match(/create task: (.+)/);
        const title = titleMatch ? titleMatch[1].trim() : 'New Task';

        const response: MasterResponse = {
          message: `Task "${title}" created.`,
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

      // Simple detection for creating agent
      if (content.includes('sukurk agent') || content.includes('create agent')) {
        // Extract name and role from message (naive)
        const nameMatch = content.match(/sukurk agent: (.+)/) || content.match(/create agent: (.+)/);
        const name = nameMatch ? nameMatch[1].trim() : 'New Agent';

        const response: MasterResponse = {
          message: `Agent "${name}" created.`,
          action: {
            type: 'CREATE_AGENT',
            payload: {
              name,
              role: 'general',
            },
          },
        };

        return NextResponse.json(response);
      }

      // If message contains question or request for recommended agent type
      if (content.includes('koks agentas') || content.includes('recommended agent') || content.includes('recommend agent')) {
        // We cannot check agent state here
        const response: MasterResponse = {
          message: 'Agent state is not available in the API route. Recommended action: create a general agent next.',
          action: {
            type: 'NONE',
          },
        };

        return NextResponse.json(response);
      }

      // Default response for other messages
      const response: MasterResponse = {
        message: 'Agent state is not available in the API route. No action taken.',
        action: {
          type: 'NONE',
        },
      };

      return NextResponse.json(response);
    }

    // If no recognized payload, return default
    return NextResponse.json({
      message: 'Invalid request payload.',
      action: {
        type: 'NONE',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Error processing request.',
        action: {
          type: 'NONE',
        },
      },
      { status: 500 }
    );
  }
}
