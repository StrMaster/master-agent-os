'use server';

import { NextRequest, NextResponse } from 'next/server';
import { useMasterStore } from '@/lib/master-store';
import {
  MasterAction,
  MasterResponse,
} from '@/lib/master-types';

// Helper function to detect recommended agent type based on task title
function detectRecommendedAgentType(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes('login') || lower.includes('page') || lower.includes('ui') || lower.includes('dashboard') || lower.includes('layout') || lower.includes('frontend')) {
    return 'frontend';
  }

  if (lower.includes('api') || lower.includes('auth') || lower.includes('database') || lower.includes('backend') || lower.includes('server') || lower.includes('db')) {
    return 'backend';
  }

  if (lower.includes('chatbot')) {
    return 'chatbot';
  }

  if (lower.includes('analyst')) {
    return 'analyst';
  }

  return 'general';
}

export async function POST(req: NextRequest) {
  const json = await req.json();

  // Use the store
  const store = useMasterStore();

  // We expect a mode and payload
  const mode = json.mode;

  if (mode === 'CREATE_TASK') {
    const title = json.title;
    const priority = json.priority || 'medium';

    // Create the task
    store.createTask({ title, priority });

    // Detect recommended agent type
    const recommendedAgentType = detectRecommendedAgentType(title);

    // Check if any agents exist
    const agentsExist = store.agents && store.agents.length > 0;

    // Build base message
    let message = `Task created: ${title}\nRecommended agent type: ${recommendedAgentType}`;

    if (!agentsExist) {
      message += `\nNo agents found. Recommended action: create a ${recommendedAgentType} agent.`;
    }

    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority,
      },
    };

    const response: MasterResponse = {
      message,
      action,
    };

    return NextResponse.json(response);
  }

  // Default fallback response
  return NextResponse.json({ message: 'Unsupported mode', action: { type: 'NONE' } });
}
