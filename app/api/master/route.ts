'use server';

import { NextRequest, NextResponse } from 'next/server';
import { ChatMessage, MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Regex to match command prefixes (case insensitive) with optional colon and spaces
const commandPrefixRegex = /^(sukurk task:?|create task:?|add task:?)/i;

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();

    const messages: ChatMessage[] = json.messages || [];

    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

    if (!lastUserMessage) {
      return NextResponse.json({
        message: 'No user message found.',
        action: { type: 'NONE' },
      } as MasterResponse);
    }

    let content = lastUserMessage.content.trim();

    // Check if content starts with any of the command prefixes
    if (commandPrefixRegex.test(content)) {
      // Remove the prefix
      content = content.replace(commandPrefixRegex, '').trim();

      // Remove leading colon if any leftover
      if (content.startsWith(':')) {
        content = content.slice(1).trim();
      }

      // If after cleaning content is empty, respond with NONE
      if (!content) {
        return NextResponse.json({
          message: 'Task title is empty after removing command prefix.',
          action: { type: 'NONE' },
        } as MasterResponse);
      }

      // Respond with action to create task with cleaned title
      const action: MasterAction = {
        type: 'CREATE_TASK',
        payload: {
          title: content,
          priority: 'medium',
        },
      };

      return NextResponse.json({
        message: `Task created: ${content}`,
        action,
      } as MasterResponse);
    }

    // If no recognized command prefix, respond with NONE
    return NextResponse.json({
      message: 'No recognized command prefix found.',
      action: { type: 'NONE' },
    } as MasterResponse);
  } catch (error) {
    return NextResponse.json({
      message: 'Error processing request.',
      action: { type: 'NONE' },
    } as MasterResponse);
  }
}
