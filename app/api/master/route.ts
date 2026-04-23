'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Helper function to determine priority based on keywords
function determinePriority(input: string): 'high' | 'medium' | 'low' {
  const lower = input.toLowerCase();

  const highKeywords = ['bug', 'error', 'fix', 'broken', 'mobile', 'ui issue', 'overflow', 'layout broken'];
  const mediumKeywords = ['improve', 'enhance'];
  const lowKeywords = ['refactor', 'cleanup'];

  if (highKeywords.some((kw) => lower.includes(kw))) {
    return 'high';
  }

  if (mediumKeywords.some((kw) => lower.includes(kw))) {
    return 'medium';
  }

  if (lowKeywords.some((kw) => lower.includes(kw))) {
    return 'low';
  }

  // Default priority
  return 'medium';
}

// Helper function to generate impact based on input
function generateImpact(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('bug') || lower.includes('error') || lower.includes('fix') || lower.includes('broken')) {
    return 'Critical bugs or errors degrade user experience and can cause data loss or crashes.';
  }

  if (lower.includes('mobile') || lower.includes('ui issue') || lower.includes('overflow') || lower.includes('layout broken')) {
    return 'Poor mobile navigation reduces usability and user retention.';
  }

  if (lower.includes('improve') || lower.includes('enhance')) {
    return 'Enhancements improve overall system efficiency and user satisfaction.';
  }

  if (lower.includes('refactor') || lower.includes('cleanup')) {
    return 'Code cleanup reduces technical debt and improves maintainability.';
  }

  return 'Task impacts system functionality or user experience based on the described context.';
}

// Helper function to generate reasoning based on input
function generateReasoning(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('bug') || lower.includes('error') || lower.includes('fix') || lower.includes('broken')) {
    return 'User mentioned bugs or errors indicating urgent fixes are needed.';
  }

  if (lower.includes('mobile') || lower.includes('ui issue') || lower.includes('overflow') || lower.includes('layout broken')) {
    return 'User reported mobile UI issues, highlighting critical usability problems.';
  }

  if (lower.includes('improve') || lower.includes('enhance')) {
    return 'User requested improvements to enhance system features or performance.';
  }

  if (lower.includes('refactor') || lower.includes('cleanup')) {
    return 'User suggested refactoring or cleanup to improve code quality.';
  }

  return 'Task created based on user input context to address specific needs.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        message: 'No messages provided.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    // Extract user message content
    const userMessage = messages.find((m: any) => m.role === 'user');
    if (!userMessage) {
      return NextResponse.json({
        message: 'No user message found.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    const inputContent = userMessage.content;

    // Determine priority
    const priority = determinePriority(inputContent);

    // Generate impact and reasoning
    const impact = generateImpact(inputContent);
    const reasoning = generateReasoning(inputContent);

    // Compose task title from user input (simple heuristic: first sentence or trimmed input)
    const title = inputContent.split(/[.?!]/)[0].trim() || 'New Task';

    // Compose steps placeholder
    const steps = [
      'Analyze the user input for detailed requirements.',
      'Break down the task into subtasks as needed.',
      'Assign to appropriate agent based on task type.',
      'Execute and monitor progress.',
    ];

    // Compose response message
    const message = `Task created:\n\nTitle: ${title}\nPriority: ${priority.toUpperCase()}\nImpact: ${impact}\nReasoning: ${reasoning}\nSteps: ${steps.join(' ')}`;

    // Return action to create task with priority
    const action = {
      type: 'CREATE_TASK',
      payload: {
        title,
        priority,
      },
    };

    return NextResponse.json({ message, action } as MasterResponse);
  } catch (error) {
    return NextResponse.json({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }
}
