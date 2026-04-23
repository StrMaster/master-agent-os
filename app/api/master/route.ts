'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';

// Helper function to clean and improve English title
function cleanTitle(rawTitle: string): string {
  // Remove any leading command words like 'sukurk task:', 'create task:', etc.
  let title = rawTitle.trim();
  title = title.replace(/^sukurk task:?\s*/i, '');
  title = title.replace(/^create task:?\s*/i, '');
  title = title.replace(/^make task:?\s*/i, '');
  title = title.replace(/^task:?\s*/i, '');

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Simple replacements for common Lithuanian words to English
  // (limited, just for example)
  title = title.replace(/pagerinti/i, 'Improve');
  title = title.replace(/navigacij[ao]/i, 'navigation');

  // Remove trailing punctuation
  title = title.replace(/[.?!]$/, '');

  return title;
}

// Generate structured subtasks for CEO-level reasoning
function generateSubtasks(title: string): string[] {
  const lower = title.toLowerCase();

  // Example for mobile navigation improvement
  if (lower.includes('mobile navigation') || lower.includes('mobile nav')) {
    return [
      'Analyze current mobile layout issues',
      'Fix sidebar visibility and toggle behavior',
      'Prevent horizontal overflow',
      'Improve responsive layout and spacing',
      'Test on different screen sizes',
    ];
  }

  // Generic fallback subtasks for other tasks
  return [
    'Define scope and objectives',
    'Break down task into smaller components',
    'Assign responsibilities',
    'Implement and test each component',
    'Review and finalize the task',
  ];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Detect intent from messages
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({
        message: 'Invalid request: missing messages array.',
        action: { type: 'NONE' },
      });
    }

    // Extract last user message
    const lastUserMessage = [...body.messages].reverse().find((m: any) => m.role === 'user');
    if (!lastUserMessage) {
      return NextResponse.json({
        message: 'No user message found.',
        action: { type: 'NONE' },
      });
    }

    const content: string = lastUserMessage.content.trim();

    // Simple intent detection for creating a task
    const createTaskRegex = /(?:sukurk|create|make|task)\s*:?\s*(.+)/i;
    const match = content.match(createTaskRegex);

    if (match) {
      const rawTitle = match[1];
      const cleanedTitle = cleanTitle(rawTitle);

      // Generate subtasks with CEO-level reasoning
      const subtasks = generateSubtasks(cleanedTitle);

      // Compose response message with title and steps
      const stepsList = subtasks.map((step) => `- ${step}`).join('\n');

      const message = `Task created:\n\nTitle: ${cleanedTitle}\n\nSteps:\n${stepsList}`;

      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title: cleanedTitle,
          priority: 'medium',
        },
      };

      // Also include breakdown action to add subtasks
      const breakdownAction: MasterAction = {
        type: 'BREAKDOWN_TASK',
        payload: {
          taskTitle: cleanedTitle,
          subtasks,
        },
      };

      // Return combined response with message and first action
      // The client code applies actions sequentially, so we can return only one action here
      // We will embed the breakdown subtasks in the message and rely on client to call breakdownTask

      return NextResponse.json({
        message,
        action,
      });
    }

    // Default fallback response
    return NextResponse.json({
      message: "Sorry, I didn't understand that. Please try again.",
      action: { type: 'NONE' },
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    });
  }
}
