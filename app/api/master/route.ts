'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  MasterAction,
  MasterResponse,
} from '@/lib/master-types';

// Removed import of loadInitialState and dynamic import of master-store

// Helper to detect if the message is a question or info query
function isQuestionOrInfoQuery(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('ar turime') ||
    lower.includes('kiek yra') ||
    lower.includes('info') ||
    lower.includes('informacija') ||
    lower.includes('kokie') ||
    lower.includes('kas yra') ||
    lower.includes('kur yra')
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // We expect body to have messages array
    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          message: 'Nėra pateiktų žinučių.',
          action: { type: 'NONE' },
        } as MasterResponse
      );
    }

    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content as string;

    // If the message is a question or info query, return safe NONE response
    if (isQuestionOrInfoQuery(content)) {
      return NextResponse.json(
        {
          message: 'Šiuo metu nėra informacijos apie užduotis ar agentus.',
          action: { type: 'NONE' },
        } as MasterResponse
      );
    }

    // Handle create task command
    if (/sukurk\s+task/i.test(content)) {
      // Extract title and priority from content
      // Example: "Sukurk task: login page with high priority"
      const titleMatch = content.match(/sukurk\s+task[:]?\s*(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled Task';

      // Default priority
      let priority: 'low' | 'medium' | 'high' = 'medium';

      if (/high/i.test(content)) {
        priority = 'high';
      } else if (/low/i.test(content)) {
        priority = 'low';
      }

      return NextResponse.json(
        {
          message: `Užduotis '${title}' sukurta su prioriteto lygiu '${priority}'.`,
          action: {
            type: 'CREATE_TASK',
            payload: {
              title,
              priority,
            },
          },
        } as MasterResponse
      );
    }

    // Handle create agent command
    if (/sukurk\s+agent/i.test(content)) {
      // Extract name and role
      // Example: "Sukurk agentą frontend developer"
      const nameMatch = content.match(/sukurk\s+agent(?:ą|a)?[:]?\s*(.+)/i);
      const nameRole = nameMatch ? nameMatch[1].trim() : '';

      let name = 'Untitled Agent';
      let role = 'general';

      if (nameRole) {
        // Try to split name and role by space
        const parts = nameRole.split(/\s+/);
        if (parts.length >= 2) {
          name = parts.slice(0, parts.length - 1).join(' ');
          role = parts[parts.length - 1];
        } else {
          name = nameRole;
        }
      }

      return NextResponse.json(
        {
          message: `Agentas '${name}' sukurta su role '${role}'.`,
          action: {
            type: 'CREATE_AGENT',
            payload: {
              name,
              role,
            },
          },
        } as MasterResponse
      );
    }

    // Default fallback response
    return NextResponse.json(
      {
        message: 'Komanda nesuprasta arba nepalaikoma.',
        action: { type: 'NONE' },
      } as MasterResponse
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Įvyko klaida apdorojant užklausą.',
        action: { type: 'NONE' },
      } as MasterResponse
    );
  }
}
