'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper function to determine recommended agent type based on task title
function recommendAgentType(title: string): { agent: string; nextStep: string } {
  const lower = title.toLowerCase();

  if (
    lower.includes('ui') ||
    lower.includes('mobile') ||
    lower.includes('frontend') ||
    lower.includes('page') ||
    lower.includes('layout') ||
    lower.includes('navigation')
  ) {
    return {
      agent: 'frontend',
      nextStep: 'assign this task to a frontend agent and begin UI fixes.',
    };
  }

  if (
    lower.includes('api') ||
    lower.includes('backend') ||
    lower.includes('database') ||
    lower.includes('auth') ||
    lower.includes('server')
  ) {
    return {
      agent: 'backend',
      nextStep: 'assign this task to a backend agent and start API development.',
    };
  }

  if (
    lower.includes('chatbot') ||
    lower.includes('prompt') ||
    lower.includes('assistant') ||
    lower.includes('conversation')
  ) {
    return {
      agent: 'chatbot',
      nextStep: 'assign this task to a chatbot agent and begin conversation design.',
    };
  }

  if (
    lower.includes('analysis') ||
    lower.includes('review') ||
    lower.includes('metrics') ||
    lower.includes('report')
  ) {
    return {
      agent: 'analyst',
      nextStep: 'assign this task to an analyst agent and start data review.',
    };
  }

  return {
    agent: 'general',
    nextStep: 'assign this task to a general agent and begin work.',
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Detect action type
    if (body.action && typeof body.action === 'object') {
      const action = body.action as MasterAction;

      switch (action.type) {
        case 'CREATE_TASK': {
          // Use store to create task
          const { createTask } = useMasterStore();
          createTask({
            title: action.payload.title,
            priority: action.payload.priority,
          });

          // Determine recommended agent and next step
          const { agent, nextStep } = recommendAgentType(action.payload.title);

          // Count subtasks if provided (not in action payload, so 0)
          // We keep existing behavior so no subtasks count here
          const message = `Task "${action.payload.title}" created.` +
            `\nRecommended agent: ${agent}` +
            `\nNext step: ${nextStep}`;

          return NextResponse.json<MasterResponse>({
            message,
            action,
          });
        }

        case 'CREATE_AGENT': {
          const { createAgent } = useMasterStore();
          createAgent({
            name: action.payload.name,
            role: action.payload.role,
          });

          return NextResponse.json<MasterResponse>({
            message: `Agent "${action.payload.name}" created.`,
            action,
          });
        }

        // For other actions, just echo back
        default: {
          return NextResponse.json<MasterResponse>({
            message: 'Action processed.',
            action,
          });
        }
      }
    }

    // Fallback NONE action
    return NextResponse.json<MasterResponse>({
      message: 'No valid action detected.',
      action: { type: 'NONE' },
    });
  } catch (error) {
    return NextResponse.json<MasterResponse>({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    });
  }
}
