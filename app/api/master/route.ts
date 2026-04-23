'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper to determine recommended agent type from task title
function getRecommendedAgentType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('frontend')) return 'frontend';
  if (lower.includes('backend')) return 'backend';
  if (lower.includes('chatbot')) return 'chatbot';
  if (lower.includes('analyst')) return 'analyst';
  return 'general';
}

// Helper to find matching agent by recommended type
function findMatchingAgent(agents: any[], type: string) {
  if (!agents || agents.length === 0) return null;

  const lowerType = type.toLowerCase();

  if (lowerType === 'general') {
    return agents[0] || null;
  }

  for (const agent of agents) {
    const nameRole = (agent.name + ' ' + agent.role).toLowerCase();
    if (nameRole.includes(lowerType)) {
      return agent;
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();

    // Access the store state safely
    const store = useMasterStore();
    if (!store) {
      return NextResponse.json({
        message: 'Store not available',
        action: { type: 'NONE' },
      });
    }

    const { createTask, createAgent, tasks, agents } = store;

    // We expect a payload with an action type
    const mode = json.mode || json.action?.type || json.type || 'NONE';

    if (mode === 'CREATE_TASK' || json.action?.type === 'CREATE_TASK') {
      const title = json.title || json.action?.payload?.title || '';
      const priority = json.priority || json.action?.payload?.priority || 'medium';

      // Create the task
      createTask({ title, priority });

      // Determine recommended agent type
      const recommendedType = getRecommendedAgentType(title);

      // Check if agents state is available
      if (!agents) {
        return NextResponse.json({
          message: `Task created. No agent state available. Recommended action: create a ${recommendedType} agent.`,
          action: { type: 'NONE' },
        });
      }

      // Find matching agent
      const matchingAgent = findMatchingAgent(agents, recommendedType);

      if (matchingAgent) {
        return NextResponse.json({
          message: `Task created. Recommended agent type: ${recommendedType}. Matching agent found: ${matchingAgent.name}. Next step: assign task to that agent.`,
          action: { type: 'NONE' },
        });
      } else {
        return NextResponse.json({
          message: `Task created. Recommended agent type: ${recommendedType}. No matching agent found. Recommended action: create a ${recommendedType} agent next.`,
          action: { type: 'NONE' },
        });
      }
    }

    if (mode === 'CREATE_AGENT' || json.action?.type === 'CREATE_AGENT') {
      const name = json.name || json.action?.payload?.name || 'Unnamed Agent';
      const role = json.role || json.action?.payload?.role || 'general';

      createAgent({ name, role });

      return NextResponse.json({
        message: `Agent '${name}' created with role '${role}'.`,
        action: { type: 'NONE' },
      });
    }

    // Fallback for other modes
    return NextResponse.json({
      message: 'No action taken.',
      action: { type: 'NONE' },
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    });
  }
}
