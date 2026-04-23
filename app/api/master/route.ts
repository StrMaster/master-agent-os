'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Helper function to classify user intent from messages
function classifyIntent(messages: { role: string; content: string }[]): MasterAction {
  // Combine all user messages content
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ');

  // Define keywords for intents
  const createTaskKeywords = ['create task', 'add task', 'new task', 'sukurti task', 'pridėti task', 'kurk task', 'kurti task', 'taskas', 'taską', 'taską sukurk', 'taską pridėk'];
  const createAgentKeywords = ['create agent', 'add agent', 'new agent', 'sukurti agentą', 'pridėti agentą', 'kurk agentą', 'kurti agentą', 'agentas', 'agentą', 'agentą sukurk', 'agentą pridėk'];
  const fixKeywords = ['fix', 'fix bug', 'bug', 'klaida', 'pataisyk', 'taisyk', 'remontuoti', 'sutvarkyk'];
  const improveKeywords = ['improve', 'enhance', 'optimize', 'optimizuoti', 'pagerinti', 'patobulinti'];

  // Check for explicit create task intent
  const hasCreateTask = createTaskKeywords.some(keyword => userMessages.includes(keyword));
  // Check for explicit create agent intent
  const hasCreateAgent = createAgentKeywords.some(keyword => userMessages.includes(keyword));

  // Check for fix or improve keywords
  const hasFix = fixKeywords.some(keyword => userMessages.includes(keyword));
  const hasImprove = improveKeywords.some(keyword => userMessages.includes(keyword));

  // If user explicitly requests to create a task
  if (hasCreateTask) {
    // Extract title and priority from message (simple heuristic)
    // For demo, use default priority 'medium' and title as first sentence
    const titleMatch = userMessages.match(/task (?:called|named)?\s*"([^"]+)"/i);
    const title = titleMatch ? titleMatch[1] : 'New Task';

    // Priority detection
    let priority: 'low' | 'medium' | 'high' = 'medium';
    if (userMessages.includes('high priority') || userMessages.includes('aukštas prioritetas')) {
      priority = 'high';
    } else if (userMessages.includes('low priority') || userMessages.includes('žemas prioritetas')) {
      priority = 'low';
    }

    return {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority,
      },
    };
  }

  // If user explicitly requests to create an agent
  if (hasCreateAgent) {
    // Extract name and role from message (simple heuristic)
    // For demo, use default name and role
    const nameMatch = userMessages.match(/agent (?:called|named)?\s*"([^"]+)"/i);
    const name = nameMatch ? nameMatch[1] : 'New Agent';

    // Role detection
    let role = 'general';
    if (userMessages.includes('frontend')) {
      role = 'frontend';
    } else if (userMessages.includes('backend')) {
      role = 'backend';
    } else if (userMessages.includes('qa')) {
      role = 'qa';
    }

    return {
      type: 'CREATE_AGENT',
      payload: {
        name,
        role,
      },
    };
  }

  // If user mentions only task or agent but no explicit create request, return NONE
  const mentionsTask = userMessages.includes('task') || userMessages.includes('taską') || userMessages.includes('taskas');
  const mentionsAgent = userMessages.includes('agent') || userMessages.includes('agentą') || userMessages.includes('agentas');

  if (mentionsTask || mentionsAgent) {
    return {
      type: 'NONE',
    };
  }

  // If user mentions fix or improve, prefer fix > improve
  if (hasFix) {
    // For demo, return NONE as no explicit fix action defined
    return {
      type: 'NONE',
    };
  }

  if (hasImprove) {
    // For demo, return NONE as no explicit improve action defined
    return {
      type: 'NONE',
    };
  }

  // If unclear, return NONE
  return {
    type: 'NONE',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        {
          message: 'Invalid request: missing messages array.',
          action: { type: 'NONE' },
        },
        { status: 400 }
      );
    }

    const action = classifyIntent(body.messages);

    let message = '';

    switch (action.type) {
      case 'CREATE_TASK':
        message = `Creating task: ${action.payload.title} with priority ${action.payload.priority}.`;
        break;
      case 'CREATE_AGENT':
        message = `Creating agent: ${action.payload.name} with role ${action.payload.role}.`;
        break;
      case 'NONE':
      default:
        message = 'No actionable intent detected.';
        break;
    }

    const response: MasterResponse = {
      message,
      action,
    };

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
