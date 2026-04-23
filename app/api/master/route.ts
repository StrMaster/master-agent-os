'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse } from '@/lib/master-types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages as { role: string; content: string }[];

  if (!messages || messages.length === 0) {
    return NextResponse.json({ message: 'No messages provided.', action: { type: 'NONE' } } as MasterResponse);
  }

  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content.trim();

  // Detect commands
  // CREATE TASK
  const createTaskMatch = content.match(/^(sukurk|create) task[:\s]+(.+)/i);
  if (createTaskMatch) {
    const title = createTaskMatch[2].trim();
    if (!title) {
      return NextResponse.json({ message: 'Task title is missing.', action: { type: 'NONE' } } as MasterResponse);
    }

    return NextResponse.json({
      message: `Task "${title}" created with medium priority.",
      action: {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority: 'medium',
        },
      },
    } as MasterResponse);
  }

  // CREATE AGENT
  const createAgentMatch = content.match(/^(sukurk|create) agent[:\s]+(.+)/i);
  if (createAgentMatch) {
    const nameRole = createAgentMatch[2].trim();
    // Expect format: name role
    const parts = nameRole.split(/\s+/);
    if (parts.length < 2) {
      return NextResponse.json({ message: 'Agent name or role missing.', action: { type: 'NONE' } } as MasterResponse);
    }
    const name = parts[0];
    const role = parts.slice(1).join(' ');

    return NextResponse.json({
      message: `Agent "${name}" with role "${role}" created.",
      action: {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      },
    } as MasterResponse);
  }

  // START TASK
  const startTaskMatch = content.match(/^(pradėk|start)\s+task[:\s]+(.+)/i);
  if (startTaskMatch) {
    const title = startTaskMatch[2].trim();
    if (!title) {
      return NextResponse.json({ message: 'Task title is missing for start.', action: { type: 'NONE' } } as MasterResponse);
    }

    return NextResponse.json({
      message: `Task "${title}" moved to doing.",
      action: {
        type: 'UPDATE_TASK_STATUS',
        payload: {
          title,
          status: 'doing',
        },
      },
    } as MasterResponse);
  }

  // COMPLETE TASK
  const completeTaskMatch = content.match(/^(užbaik|complete)\s+task[:\s]+(.+)/i);
  if (completeTaskMatch) {
    const title = completeTaskMatch[2].trim();
    if (!title) {
      return NextResponse.json({ message: 'Task title is missing for complete.', action: { type: 'NONE' } } as MasterResponse);
    }

    return NextResponse.json({
      message: `Task "${title}" completed.",
      action: {
        type: 'UPDATE_TASK_STATUS',
        payload: {
          title,
          status: 'done',
        },
      },
    } as MasterResponse);
  }

  // Default fallback
  return NextResponse.json({ message: 'Command not recognized.', action: { type: 'NONE' } } as MasterResponse);
}
