'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper to remove surrounding quotes and trim
function sanitizeInput(input: string): string {
  let text = input.trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('`') && text.endsWith('`'))
  ) {
    text = text.substring(1, text.length - 1).trim();
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Extract user input text from messages
    const messages = json.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        message: 'No messages provided',
        action: { type: 'NONE' },
      });
    }

    // Assume last message is user input
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || typeof lastMessage.content !== 'string') {
      return NextResponse.json({
        message: 'Invalid message format',
        action: { type: 'NONE' },
      });
    }

    // Sanitize user input
    const cleanedText = sanitizeInput(lastMessage.content);

    // Command detection logic using cleanedText
    const lowerText = cleanedText.toLowerCase();

    // Detect create task command
    if (lowerText.startsWith('sukurk task:') || lowerText.startsWith('create task:')) {
      const title = cleanedText.substring(cleanedText.indexOf(':') + 1).trim();
      if (!title) {
        return NextResponse.json({
          message: 'Task title is missing.',
          action: { type: 'NONE' },
        });
      }

      // Default priority medium
      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority: 'medium',
        },
      };

      return NextResponse.json({
        message: `Task created: ${title}`,
        action,
      });
    }

    // Detect create agent command
    if (lowerText.startsWith('sukurk agentą:') || lowerText.startsWith('create agent:')) {
      const rest = cleanedText.substring(cleanedText.indexOf(':') + 1).trim();
      // Expect format: name role
      const parts = rest.split(' ');
      if (parts.length < 2) {
        return NextResponse.json({
          message: 'Agent name or role is missing.',
          action: { type: 'NONE' },
        });
      }
      const name = parts[0];
      const role = parts.slice(1).join(' ');

      const action: MasterAction = {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      };

      return NextResponse.json({
        message: `Agent created: ${name} with role ${role}`,
        action,
      });
    }

    // Detect send to execution command
    if (lowerText.includes('vykdyk') || lowerText.includes('execute')) {
      // Determine targetType
      let targetType: 'task' | 'agent' = 'task';
      if (lowerText.includes('agent')) {
        targetType = 'agent';
      }

      const action: MasterAction = {
        type: 'SEND_TO_EXECUTION',
        payload: {
          targetType,
        },
      };

      return NextResponse.json({
        message: `Sending to execution: ${targetType}`,
        action,
      });
    }

    // Default response
    return NextResponse.json({
      message: 'Command not recognized.',
      action: { type: 'NONE' },
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    });
  }
}
