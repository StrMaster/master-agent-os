'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// We cannot call React hooks or useMasterStore directly in server route,
// so we will simulate minimal context awareness by analyzing incoming messages

// Helper to detect if user explicitly requests to create a task
function userWantsCreateTask(content: string): boolean {
  const lowered = content.toLowerCase();
  return lowered.includes('create task') || lowered.includes('sukurk task') || lowered.includes('sukurti task') || lowered.includes('kurk task') || lowered.includes('create a task') || lowered.includes('sukurk užduotį') || lowered.includes('sukurti užduotį');
}

// Helper to detect if user explicitly requests to create an agent
function userWantsCreateAgent(content: string): boolean {
  const lowered = content.toLowerCase();
  return lowered.includes('create agent') || lowered.includes('sukurk agentą') || lowered.includes('sukurti agentą') || lowered.includes('kurk agentą') || lowered.includes('create an agent') || lowered.includes('sukurk agent');
}

// Helper to detect if user only mentions a task or agent in context without explicit creation
function userMentionsOnlyTaskOrAgent(content: string): boolean {
  const lowered = content.toLowerCase();
  // Simple heuristic: mentions "task" or "agent" but no create keywords
  const mentionsTask = lowered.includes('task') || lowered.includes('užduotis');
  const mentionsAgent = lowered.includes('agent');
  const wantsCreate = userWantsCreateTask(content) || userWantsCreateAgent(content);
  return (mentionsTask || mentionsAgent) && !wantsCreate;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const messages = json.messages as { role: string; content: string }[] | undefined;

    if (!messages || messages.length === 0) {
      const noneResponse: MasterResponse = {
        message: 'Nėra pateiktų žinučių.',
        action: { type: 'NONE' },
      };
      return NextResponse.json(noneResponse);
    }

    // Analyze last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      const noneResponse: MasterResponse = {
        message: 'Nerasta vartotojo žinutės.',
        action: { type: 'NONE' },
      };
      return NextResponse.json(noneResponse);
    }

    const content = lastUserMessage.content.trim();

    // If user only mentions a task or agent without explicit creation, do not create
    if (userMentionsOnlyTaskOrAgent(content)) {
      return NextResponse.json({
        message: 'Nustatyta, kad vartotojas tik minėjo užduotį ar agentą, bet ne prašė kurti.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    // If user explicitly wants to create a task
    if (userWantsCreateTask(content)) {
      // Extract a simple title and priority from content heuristically
      // For simplicity, set priority medium
      const titleMatch = content.match(/task\s+(\w[\w\s]*)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'New Task';

      const response: MasterResponse = {
        message: `Sukuriu užduotį: ${title}`,
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

    // If user explicitly wants to create an agent
    if (userWantsCreateAgent(content)) {
      // Extract a simple name and role from content heuristically
      // For simplicity, name = "New Agent", role = "general"
      const nameMatch = content.match(/agent\s+(\w[\w\s]*)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'New Agent';

      const response: MasterResponse = {
        message: `Sukuriu agentą: ${name}`,
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

    // If none of above, return NONE to avoid guessing
    return NextResponse.json({
      message: 'Neaiškus užklausos turinys, nebus kuriama užduotis ar agentas.',
      action: { type: 'NONE' },
    } as MasterResponse);
  } catch (error) {
    return NextResponse.json({
      message: 'Klaida apdorojant užklausą.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }
}
