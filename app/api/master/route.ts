'use server';

import { NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper to capitalize each word properly
function capitalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to generate structured subtasks description based on keywords
function generateStructuredDescription(title: string): string[] {
  const lower = title.toLowerCase();

  if (lower.includes('mobile navigation') || lower.includes('navigation')) {
    return [
      'Fix mobile sidebar behavior',
      'Prevent horizontal overflow',
      'Improve responsive layout',
    ];
  }

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

  if (lower.includes('api') || lower.includes('auth') || lower.includes('backend')) {
    return [
      'Define API endpoints',
      'Create request handlers',
      'Add validation and auth checks',
      'Handle errors and edge cases',
      'Test integration flow',
    ];
  }

  if (lower.includes('test') || lower.includes('qa') || lower.includes('validation')) {
    return [
      'Define test cases',
      'Cover happy path',
      'Cover edge cases',
      'Validate error states',
      'Document expected behavior',
    ];
  }

  // Default generic subtasks
  return [
    'Define scope',
    'Create first UI version',
    'Connect core logic',
    'Test key flows',
  ];
}

// Extract clean task title from user input
function extractTaskTitle(input: string): string {
  // Remove common verbs and filler words
  const cleaned = input
    .toLowerCase()
    .replace(/^(sukur(k|ti)|kur(k|ti)|padar(k|ti)|pagerinti|improve|fix|add|create|make|implement|build|develop)\s+/i, '')
    .trim();

  return capitalizeTitle(cleaned);
}

export async function POST(request: Request) {
  const json = await request.json();

  // Expecting messages array with last user message containing task creation intent
  const messages = json.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    const response: MasterResponse = {
      message: 'No messages provided.',
      action: { type: 'NONE' },
    };
    return NextResponse.json(response);
  }

  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
    const response: MasterResponse = {
      message: 'Invalid user message.',
      action: { type: 'NONE' },
    };
    return NextResponse.json(response);
  }

  const userInput = lastMessage.content.trim();

  // Simple intent detection for task creation
  const createTaskKeywords = ['sukur', 'kurk', 'padar', 'pagerinti', 'improve', 'fix', 'add', 'create', 'make', 'implement', 'build', 'develop'];
  const lowerInput = userInput.toLowerCase();
  const isCreateTask = createTaskKeywords.some(keyword => lowerInput.startsWith(keyword));

  if (!isCreateTask) {
    const response: MasterResponse = {
      message: 'No task creation intent detected.',
      action: { type: 'NONE' },
    };
    return NextResponse.json(response);
  }

  // Extract and improve task title
  const taskTitle = extractTaskTitle(userInput);

  // Generate structured description subtasks
  const subtasks = generateStructuredDescription(taskTitle);

  // Compose description string
  const description = subtasks.map(sub => `- ${sub}`).join('\n');

  // Compose response message
  const message = `Task created:\nTitle: ${taskTitle}\nDescription:\n${description}`;

  // Return action to create task with medium priority
  const action: MasterAction = {
    type: 'CREATE_TASK',
    payload: {
      title: taskTitle,
      priority: 'medium',
    },
  };

  const response: MasterResponse = {
    message,
    action,
  };

  return NextResponse.json(response);
}
