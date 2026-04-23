'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages as { role: string; content: string }[] | undefined;

  if (!messages || messages.length === 0) {
    return NextResponse.json({
      message: 'No messages provided.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return NextResponse.json({
      message: 'No user message found.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }

  const content = lastUserMessage.content.toLowerCase();

  // Simple intent detection
  let intent = 'none';
  if (content.includes('sukurk task') || content.includes('sukurk užduotį') || content.includes('create task')) {
    intent = 'create_task';
  } else if (content.includes('sukurk agentą') || content.includes('create agent')) {
    intent = 'create_agent';
  }

  if (intent === 'create_task') {
    // Extract title from user message
    // For simplicity, take the whole message after keywords
    let title = lastUserMessage.content.trim();
    const keywords = ['sukurk task', 'sukurk užduotį', 'create task'];
    for (const kw of keywords) {
      const idx = title.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        title = title.substring(idx + kw.length).trim();
        break;
      }
    }

    if (!title) {
      title = 'New Task';
    }

    // Generate steps (subtasks) based on title keywords
    const lowerTitle = title.toLowerCase();
    let steps: string[] = [];

    if (lowerTitle.includes('login')) {
      steps = [
        'Create login page layout',
        'Add email and password inputs',
        'Add validation states',
        'Connect authentication flow',
        'Add loading and error handling',
      ];
    } else if (lowerTitle.includes('dashboard')) {
      steps = [
        'Create dashboard layout',
        'Add summary cards',
        'Connect shared data source',
        'Add responsive behavior',
        'Polish visual hierarchy',
      ];
    } else if (
      lowerTitle.includes('api') ||
      lowerTitle.includes('auth') ||
      lowerTitle.includes('backend')
    ) {
      steps = [
        'Define API endpoints',
        'Create request handlers',
        'Add validation and auth checks',
        'Handle errors and edge cases',
        'Test integration flow',
      ];
    } else if (
      lowerTitle.includes('test') ||
      lowerTitle.includes('qa') ||
      lowerTitle.includes('validation')
    ) {
      steps = [
        'Define test cases',
        'Cover happy path',
        'Cover edge cases',
        'Validate error states',
        'Document expected behavior',
      ];
    } else {
      steps = [
        'Define scope',
        'Create first UI version',
        'Connect core logic',
        'Test key flows',
      ];
    }

    // Determine priority, impact, reasoning
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let impact = '';
    let reasoning = '';

    if (lowerTitle.includes('login') || lowerTitle.includes('auth')) {
      priority = 'high';
      impact = 'Critical for user access and security.';
      reasoning = 'Login functionality is essential for application security and user management.';
    } else if (lowerTitle.includes('dashboard')) {
      priority = 'medium';
      impact = 'Improves user experience and data visibility.';
      reasoning = 'Dashboard provides key insights and usability improvements.';
    } else if (lowerTitle.includes('test') || lowerTitle.includes('qa')) {
      priority = 'high';
      impact = 'Ensures software quality and reliability.';
      reasoning = 'Testing is vital to prevent bugs and maintain stability.';
    } else if (lowerTitle.includes('api') || lowerTitle.includes('backend')) {
      priority = 'high';
      impact = 'Supports core application functionality and integrations.';
      reasoning = 'Backend and API are fundamental for data processing and communication.';
    } else {
      priority = 'low';
      impact = 'General task with moderate importance.';
      reasoning = 'Task contributes to project progress but is not urgent.';
    }

    // Compose message
    const message = `Task created:\n\nTitle: ${title}\nPriority: ${priority}\nImpact: ${impact}\nReasoning: ${reasoning}\nSteps:\n- ${steps.join('\n- ')}`;

    // Return structured response
    return NextResponse.json({
      message,
      action: {
        type: 'CREATE_TASK',
        payload: {
          title,
          priority,
        },
      },
    } as MasterResponse);
  }

  if (intent === 'create_agent') {
    // Simplified agent creation response
    const name = 'New Agent';
    const role = 'general';

    const message = `Agent created:\n\nName: ${name}\nRole: ${role}`;

    return NextResponse.json({
      message,
      action: {
        type: 'CREATE_AGENT',
        payload: {
          name,
          role,
        },
      },
    } as MasterResponse);
  }

  // Fallback
  return NextResponse.json({
    message: 'Sorry, I did not understand your request.',
    action: { type: 'NONE' },
  } as MasterResponse);
}
