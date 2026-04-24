'use server';

import { NextRequest, NextResponse } from 'next/server';
import { Configuration, OpenAIApi } from 'openai';
import { MasterResponse, MasterAction } from '@/lib/master-types';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const validActionTypes = new Set([
  'CREATE_TASK',
  'CREATE_AGENT',
  'UPDATE_TASK_STATUS',
  'NONE',
]);

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        {
          message: 'Invalid request format.',
          action: { type: 'NONE' },
        },
        { status: 400 }
      );
    }

    // Compose prompt for OpenAI
    const prompt = `You are Master Agent. You receive user messages and respond with JSON containing a message and an action.

Allowed action types are exactly: CREATE_TASK, CREATE_AGENT, UPDATE_TASK_STATUS, NONE.

Respond with JSON object with keys: message (string), action (object with type and optional payload).

Example:
{
  "message": "Sukurtas naujas taskas.",
  "action": {
    "type": "CREATE_TASK",
    "payload": {
      "title": "Naujas taskas",
      "priority": "medium"
    }
  }
}

If the user command is not recognized, respond with action type NONE.

User messages:
${messages.map(m => m.content).join('\n')}

Respond now.`;

    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const rawResponse = completion.data.choices[0].message?.content ?? '';

    let parsedResponse: MasterResponse;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      // fallback to NONE action
      parsedResponse = {
        message: 'Atsiprašome, nepavyko apdoroti užklausos.',
        action: { type: 'NONE' },
      };
    }

    // Validate action type strictly
    if (
      !parsedResponse.action ||
      typeof parsedResponse.action.type !== 'string' ||
      !validActionTypes.has(parsedResponse.action.type)
    ) {
      parsedResponse.action = { type: 'NONE' };
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Server error.',
        action: { type: 'NONE' },
      },
      { status: 500 }
    );
  }
}
