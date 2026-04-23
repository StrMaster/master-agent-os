import { NextRequest, NextResponse } from 'next/server';
import { useMasterStore } from '@/lib/master-store';
import { MasterAction, MasterResponse } from '@/lib/master-types';

// We cannot use useMasterStore() React hook in API route.
// Instead, access store state directly via useMasterStore.getState()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Access store state safely
    const state = useMasterStore.getState?.() ?? { agents: [], tasks: [] };
    const agents = state?.agents ?? [];

    // Detect action type from request body
    // For example, create_task or create_agent or question detection

    // Example: if body has 'mode' field
    if (body.mode === 'create_task') {
      // Create task action
      const title = body.title ?? 'Untitled Task';
      const priority = body.priority ?? 'medium';

      // Check if matching agent exists for auto assignment
      const lowerTitle = title.toLowerCase();
      const matchedAgent = agents.find(agent => {
        return (
          agent?.name?.toLowerCase().includes(lowerTitle) ||
          agent?.role?.toLowerCase().includes(lowerTitle)
        );
      });

      const message = matchedAgent
        ? `Task created and matched with agent: ${matchedAgent.name}`
        : `No matching agent found. Recommended action: create a task agent next.`;

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

    if (body.mode === 'create_agent') {
      const name = body.name ?? 'Untitled Agent';
      const role = body.role ?? 'general';

      // Check if matching agent exists (should not exist since creating new)
      const matchedAgent = agents.find(agent => {
        return (
          agent?.name?.toLowerCase() === name.toLowerCase() &&
          agent?.role?.toLowerCase() === role.toLowerCase()
        );
      });

      const message = matchedAgent
        ? `Agent already exists: ${matchedAgent.name}`
        : `Agent created: ${name}`;

      const action: MasterAction = {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      };

      const response: MasterResponse = {
        message,
        action,
      };

      return NextResponse.json(response);
    }

    // Fallback: return safe response with action CREATE_TASK
    const fallbackAction: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title: 'Fallback Task',
        priority: 'medium',
      },
    };

    const fallbackResponse: MasterResponse = {
      message: 'No matching agent found. Recommended action: create a task agent next.',
      action: fallbackAction,
    };

    return NextResponse.json(fallbackResponse);
  } catch (error) {
    // On error, return safe response
    const safeAction: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title: 'Error Task',
        priority: 'medium',
      },
    };

    const safeResponse: MasterResponse = {
      message: 'Error processing request. Recommended action: create a task agent next.',
      action: safeAction,
    };

    return NextResponse.json(safeResponse);
  }
}
