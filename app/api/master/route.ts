'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { loadInitialState } from '@/lib/master-store';

// Simulated AI reasoning function (replace with real AI call in production)
async function callMasterAgentAI(
  messages: { role: string; content: string }[],
  context: { tasks: any[]; agents: any[] }
): Promise<MasterResponse> {
  // Basic reasoning logic to demonstrate context usage and duplicate prevention

  // Extract last user message
  const lastUserMessage = messages.reverse().find(m => m.role === 'user');
  if (!lastUserMessage) {
    return {
      message: 'No user input provided.',
      action: { type: 'NONE' },
    };
  }

  const input = lastUserMessage.content.toLowerCase();

  // Check if input is about creating a task
  if (input.includes('create task') || input.includes('sukurti task') || input.includes('kurk task') || input.includes('kurk užduotį') || input.includes('kurk užduotį')) {
    // Extract title and priority if possible
    // For simplicity, assume title is after 'task' or 'užduotį'
    let titleMatch = input.match(/task (.+)/) || input.match(/užduotį (.+)/);
    let title = titleMatch ? titleMatch[1].trim() : 'New Task';

    // Check for duplicate task by title
    const duplicateTask = context.tasks.find(t => t.title.toLowerCase() === title.toLowerCase());
    if (duplicateTask) {
      return {
        message: `Task titled "${title}" already exists. No duplicate created.`,
        action: { type: 'NONE' },
      };
    }

    // Determine priority from input
    let priority: 'low' | 'medium' | 'high' = 'medium';
    if (input.includes('high priority') || input.includes('aukštas prioritetas')) {
      priority = 'high';
    } else if (input.includes('low priority') || input.includes('žemas prioritetas')) {
      priority = 'low';
    }

    return {
      message: `Creating task titled "${title}" with priority ${priority}.`,
      action: {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority,
        },
      },
    };
  }

  // Check if input is about creating an agent
  if (input.includes('create agent') || input.includes('sukurti agentą') || input.includes('kurk agentą')) {
    // Extract name and role
    // For simplicity, assume name after 'agent' or 'agentą', role after 'role' or 'rolė'
    let nameMatch = input.match(/agent(?:ą|a)? ([^,\.]+)/);
    let name = nameMatch ? nameMatch[1].trim() : 'New Agent';

    // Check for duplicate agent by name
    const duplicateAgent = context.agents.find(a => a.name.toLowerCase() === name.toLowerCase());
    if (duplicateAgent) {
      return {
        message: `Agent named "${name}" already exists. No duplicate created.`,
        action: { type: 'NONE' },
      };
    }

    // Determine role
    let role = 'general';
    let roleMatch = input.match(/role (\w+)/) || input.match(/rol[eė] (\w+)/);
    if (roleMatch) {
      role = roleMatch[1].toLowerCase();
    }

    return {
      message: `Creating agent named "${name}" with role ${role}.`,
      action: {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      },
    };
  }

  // Check if input is about sending to execution
  if (input.includes('execute') || input.includes('vykdyti') || input.includes('paleisti')) {
    // Determine target type
    let targetType: 'task' | 'agent' = 'task';
    if (input.includes('agent')) {
      targetType = 'agent';
    }

    return {
      message: `Sending ${targetType} to execution.`,
      action: {
        type: 'SEND_TO_EXECUTION',
        payload: {
          targetType,
        },
      },
    };
  }

  // Default fallback
  return {
    message: 'No actionable command detected.',
    action: { type: 'NONE' },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Load current state from storage (simulate server-side state load)
    const currentState = loadInitialState();

    // Use provided context if any, else use current state
    const context = body.context || {
      tasks: currentState.tasks,
      agents: currentState.agents,
    };

    // Extract messages from request
    const messages = body.messages || [];

    // Call AI reasoning function with messages and context
    const response = await callMasterAgentAI(messages, context);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Error processing request.',
        action: { type: 'NONE' },
      },
      { status: 500 }
    );
  }
}
