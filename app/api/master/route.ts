'use server';

import { NextRequest, NextResponse } from 'next/server';
import { useMasterStore } from '@/lib/master-store';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Helper function to extract keyword from question
function extractKeyword(text: string, patterns: string[]): string | null {
  const lower = text.toLowerCase();
  for (const pattern of patterns) {
    const idx = lower.indexOf(pattern);
    if (idx !== -1) {
      // Extract the part after the pattern
      let after = lower.slice(idx + pattern.length).trim();
      // Remove trailing question marks or punctuation
      after = after.replace(/[?!.]*$/, '').trim();
      // Extract first word as keyword
      const words = after.split(/\s+/);
      if (words.length > 0 && words[0].length > 0) {
        return words[0];
      }
    }
  }
  return null;
}

// Compose readable response for found tasks and agents
function composeResponse(keyword: string, tasks: any[], agents: any[]): string {
  const foundTasks = tasks.filter((task) => task.title.toLowerCase().includes(keyword));
  const foundAgents = agents.filter(
    (agent) => agent.name.toLowerCase().includes(keyword) || agent.role.toLowerCase().includes(keyword)
  );

  if (foundTasks.length === 0 && foundAgents.length === 0) {
    return 'Kol kas tokio task nėra.';
  }

  const parts: string[] = [];

  if (foundTasks.length > 0) {
    if (foundTasks.length === 1) {
      parts.push(`Taip, turime task: ${foundTasks[0].title}`);
    } else {
      const titles = foundTasks.map((t) => t.title).join(', ');
      parts.push(`Taip, turime tasks: ${titles}`);
    }
  }

  if (foundAgents.length > 0) {
    if (foundAgents.length === 1) {
      parts.push(`Taip, turime agentą: ${foundAgents[0].name} (${foundAgents[0].role})`);
    } else {
      const names = foundAgents.map((a) => `${a.name} (${a.role})`).join(', ');
      parts.push(`Taip, turime agentus: ${names}`);
    }
  }

  return parts.join(' ');
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // We expect messages array
    const messages = json.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        message: 'Command not recognized.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || typeof lastMessage.content !== 'string') {
      return NextResponse.json({
        message: 'Command not recognized.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    const text = lastMessage.content.trim();
    const lowerText = text.toLowerCase();

    // Detect Lithuanian question patterns
    const questionPatterns = ['ar turime', 'ar yra', 'turime', 'yra'];
    const hasQuestionPattern = questionPatterns.some((p) => lowerText.includes(p));

    if (hasQuestionPattern) {
      // Extract keyword
      const keyword = extractKeyword(lowerText, questionPatterns);

      if (keyword) {
        // Access store data
        // We cannot use React hooks here, so import store data directly
        // Instead, we import the store and load initial state
        const { loadInitialState } = await import('@/lib/master-store');
        const state = loadInitialState();

        const responseMessage = composeResponse(keyword, state.tasks, state.agents);

        return NextResponse.json({
          message: responseMessage,
          action: { type: 'NONE' },
        } as MasterResponse);
      }
    }

    // Existing logic for create task or agent commands
    // We will parse commands like 'sukurk task ...' or 'sukurk agentą ...'

    // Simple command parsing
    if (lowerText.startsWith('sukurk task')) {
      // Extract title and optional priority
      // Example: "Sukurk task login page priority high"
      const match = text.match(/sukurk task (.+?)( priority (low|medium|high))?$/i);
      if (match) {
        const title = match[1].trim();
        const priority = (match[3] || 'medium') as 'low' | 'medium' | 'high';

        return NextResponse.json({
          message: `Task '${title}' sukurtas su priority '${priority}'.`,
          action: {
            type: 'CREATE_TASK',
            payload: { title, priority },
          },
        } as MasterResponse);
      }
    }

    if (lowerText.startsWith('sukurk agent')) {
      // Extract name and role
      // Example: "Sukurk agentą Jonas role frontend"
      const match = text.match(/sukurk agent(?:ą|a) (.+?)( role (.+))?$/i);
      if (match) {
        const name = match[1].trim();
        const role = (match[3] || 'general').trim();

        return NextResponse.json({
          message: `Agentas '${name}' sukurtas su role '${role}'.`,
          action: {
            type: 'CREATE_AGENT',
            payload: { name, role },
          },
        } as MasterResponse);
      }
    }

    // Fallback response
    return NextResponse.json({
      message: 'Command not recognized.',
      action: { type: 'NONE' },
    } as MasterResponse);
  } catch (error) {
    return NextResponse.json({
      message: 'Įvyko klaida apdorojant užklausą.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }
}
