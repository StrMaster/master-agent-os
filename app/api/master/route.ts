'use server';

import { NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// This API route handles POST requests to /api/master
// It expects a JSON body with messages array

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Extract last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

    if (!lastUserMessage) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    const content = lastUserMessage.content.trim().toLowerCase();

    // Basic parsing to detect task creation intent
    // Example triggers: "create task", "sukurti taską", "kurk taską", "sukurk taską"
    const createTaskTriggers = [
      'create task',
      'create a task',
      'sukurti taską',
      'kurk taską',
      'sukurk taską',
      'create task:',
      'add task',
      'new task',
    ];

    const isCreateTask = createTaskTriggers.some(trigger => content.startsWith(trigger));

    if (isCreateTask) {
      // Extract title from message
      // Assume format: "create task: <title>"
      let title = content;
      for (const trigger of createTaskTriggers) {
        if (title.startsWith(trigger)) {
          title = title.slice(trigger.length).trim();
          break;
        }
      }

      if (!title) {
        title = 'Untitled Task';
      }

      // Determine priority heuristically from title or default to medium
      let priority: 'low' | 'medium' | 'high' = 'medium';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('urgent') || lowerTitle.includes('high')) {
        priority = 'high';
      } else if (lowerTitle.includes('low') || lowerTitle.includes('minor')) {
        priority = 'low';
      }

      // Compose impact and reasoning based on title keywords
      let impact = '';
      let reasoning = '';

      if (lowerTitle.includes('mobile')) {
        impact = 'Poor mobile UX reduces usability and retention.';
        reasoning = 'User is experiencing layout issues on mobile (overflow, sidebar blocking UI).';
      } else if (lowerTitle.includes('login')) {
        impact = 'Login issues block user access and reduce engagement.';
        reasoning = 'Users face problems authenticating, causing drop-offs.';
      } else if (lowerTitle.includes('dashboard')) {
        impact = 'Dashboard is key for user insights and monitoring.';
        reasoning = 'Current dashboard lacks clarity and responsiveness.';
      } else {
        impact = 'Improving this task will enhance overall system quality.';
        reasoning = 'Task addresses important feature or bug fix.';
      }

      // Compose steps for subtasks (reuse existing logic from chat page buildLocalSubtasks)
      const buildLocalSubtasks = (taskTitle: string): string[] => {
        const lower = taskTitle.toLowerCase();

        if (lower.includes('login')) {
          return [
            'Create login page layout',
            'Add email and password inputs',
            'Add validation states',
            'Connect authentication flow',
            'Add loading and error handling',
          ];
        }

        if (lower.includes('dashboard')) {
          return [
            'Create dashboard layout',
            'Add summary cards',
            'Connect shared data source',
            'Add responsive behavior',
            'Polish visual hierarchy',
          ];
        }

        if (
          lower.includes('api') ||
          lower.includes('auth') ||
          lower.includes('backend')
        ) {
          return [
            'Define API endpoints',
            'Create request handlers',
            'Add validation and auth checks',
            'Handle errors and edge cases',
            'Test integration flow',
          ];
        }

        if (
          lower.includes('test') ||
          lower.includes('qa') ||
          lower.includes('validation')
        ) {
          return [
            'Define test cases',
            'Cover happy path',
            'Cover edge cases',
            'Validate error states',
            'Document expected behavior',
          ];
        }

        if (lower.includes('mobile')) {
          return [
            'Analyze current mobile layout issues',
            'Fix sidebar visibility and toggle behavior',
            'Prevent horizontal overflow',
            'Improve responsive layout and spacing',
            'Test on different screen sizes',
          ];
        }

        return [
          'Define scope',
          'Create first UI version',
          'Connect core logic',
          'Test key flows',
        ];
      };

      const subtasks = buildLocalSubtasks(title);

      // Compose response message with enhanced details
      const message = `Task created:\n\nTitle: ${title}\n\nPriority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}\n\nImpact:\n${impact}\n\nReasoning:\n${reasoning}\n\nSteps:\n- ${subtasks.join('\n- ')}`;

      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority,
        },
      };

      return NextResponse.json({ message, action });
    }

    // Default fallback response
    const defaultMessage = 'Aš esu Master Agent. Galiu kurti tasks ir agents. Prašome pateikti užklausą.';
    const defaultAction: MasterAction = { type: 'NONE' };

    return NextResponse.json({ message: defaultMessage, action: defaultAction });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
