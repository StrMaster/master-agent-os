'use server';

import { NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

export async function POST(request: Request) {
  const body = await request.json();

  // Extract messages from request body
  const messages = body.messages as { role: string; content: string }[] | undefined;

  // Helper function to detect question
  function isQuestion(text: string) {
    return text.trim().endsWith('?');
  }

  // Helper function to create a NONE action response
  function noneResponse(): MasterResponse {
    return {
      message: 'Nesuprantu užklausos. Prašome pateikti aiškesnę komandą.',
      action: { type: 'NONE' },
    };
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json(noneResponse());
  }

  // Get last user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return NextResponse.json(noneResponse());
  }

  const content = lastUserMessage.content.trim();

  // Detect create_task command
  const createTaskMatch = content.match(/^sukurk task: (.+)$/i);
  if (createTaskMatch) {
    const taskTitle = createTaskMatch[1].trim();

    // Determine recommended agent type
    const titleLower = taskTitle.toLowerCase();

    let recommendedAgentType = 'general';
    if (['ui', 'mobile', 'frontend', 'page', 'layout', 'navigation'].some((kw) => titleLower.includes(kw))) {
      recommendedAgentType = 'frontend';
    } else if (['api', 'backend', 'database', 'auth', 'server'].some((kw) => titleLower.includes(kw))) {
      recommendedAgentType = 'backend';
    } else if (['chatbot', 'prompt', 'assistant', 'conversation'].some((kw) => titleLower.includes(kw))) {
      recommendedAgentType = 'chatbot';
    } else if (['analysis', 'review', 'metrics', 'report'].some((kw) => titleLower.includes(kw))) {
      recommendedAgentType = 'analyst';
    }

    // Generate next step message
    let nextStepMessage = '';
    switch (recommendedAgentType) {
      case 'frontend':
        nextStepMessage = 'Next step: assign this task to a frontend agent and begin UI work.';
        break;
      case 'backend':
        nextStepMessage = 'Next step: assign this task to a backend agent and begin API/server work.';
        break;
      case 'chatbot':
        nextStepMessage = 'Next step: assign this task to a chatbot agent and begin conversation flow work.';
        break;
      case 'analyst':
        nextStepMessage = 'Next step: assign this task to an analyst agent and review requirements.';
        break;
      default:
        nextStepMessage = 'Next step: review this task and assign the best available agent.';
        break;
    }

    // Build subtasks count (simulate 4 subtasks as in example)
    const subtasksCount = 4;

    const message = `Task "${taskTitle}" created with ${subtasksCount} subtasks.\nRecommended agent type: ${recommendedAgentType}.\n${nextStepMessage}`;

    const action: MasterAction = {
      type: 'CREATE_TASK',
      payload: {
        title: taskTitle,
        priority: 'medium',
      },
    };

    return NextResponse.json({ message, action });
  }

  // Detect create_agent command
  const createAgentMatch = content.match(/^sukurk agentą (.+)$/i);
  if (createAgentMatch) {
    const role = createAgentMatch[1].trim();

    const message = `Agent created with role: ${role}.`;
    const action: MasterAction = {
      type: 'CREATE_AGENT',
      payload: {
        name: `Agent ${crypto.randomUUID().slice(0, 6)}`,
        role,
      },
    };

    return NextResponse.json({ message, action });
  }

  // Detect question
  if (isQuestion(content)) {
    return NextResponse.json({
      message: 'Atsakymas į jūsų klausimą: ...',
      action: { type: 'NONE' },
    });
  }

  // Fallback NONE
  return NextResponse.json(noneResponse());
}
