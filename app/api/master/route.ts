'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse, MasterAction } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// In-memory learning log storing last 20 actions
const learningLog: {
  timestamp: string;
  userInput: string;
  detectedIntent: string;
  success: boolean;
  note: string;
}[] = [];

function addToLearningLog(entry: {
  userInput: string;
  detectedIntent: string;
  success: boolean;
  note: string;
}) {
  learningLog.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (learningLog.length > 20) {
    learningLog.shift();
  }
}

function summarizeLearningLog() {
  const total = learningLog.length;
  const createTaskCount = learningLog.filter(e => e.detectedIntent === 'create_task').length;
  const createAgentCount = learningLog.filter(e => e.detectedIntent === 'create_agent').length;
  const noneCount = learningLog.filter(e => e.detectedIntent === 'none_or_question').length;

  const last3 = learningLog.slice(-3).map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString();
    return `- [${time}] Intent: ${e.detectedIntent}, Success: ${e.success}, Note: ${e.note}`;
  }).join('\n');

  return `Learning Log Summary:\nTotal actions: ${total}\nCreate Task: ${createTaskCount}\nCreate Agent: ${createAgentCount}\nNone/Question: ${noneCount}\nLast 3 actions:\n${last3}`;
}

function detectIntent(input: string): string {
  const lower = input.toLowerCase();

  // Check for review/log commands
  if (
    lower.includes('review your last actions') ||
    lower.includes('show learning log') ||
    lower.includes('peržiūrėk savo paskutinius veiksmus') ||
    lower.includes('rodyk learning log')
  ) {
    return 'review_log';
  }

  // Existing intent detection
  if (lower.includes('kurk task') || lower.includes('sukurk task') || lower.includes('kurk užduotį') || lower.includes('sukurk užduotį')) {
    return 'create_task';
  }

  if (lower.includes('kurk agent') || lower.includes('sukurk agent') || lower.includes('kurk agentą') || lower.includes('sukurk agentą')) {
    return 'create_agent';
  }

  if (lower.endsWith('?')) {
    return 'question';
  }

  return 'none_or_question';
}

export async function POST(req: NextRequest) {
  const json = await req.json();

  // Extract user input from messages or mode
  let userInput = '';
  if (Array.isArray(json.messages) && json.messages.length > 0) {
    const lastUserMsg = [...json.messages].reverse().find(m => m.role === 'user');
    userInput = lastUserMsg?.content ?? '';
  } else if (typeof json.mode === 'string') {
    userInput = json.mode;
  }

  const intent = detectIntent(userInput);

  // Use the store
  const store = useMasterStore();

  let response: MasterResponse = {
    message: '',
    action: { type: 'NONE', payload: {} },
  };

  if (intent === 'review_log') {
    // Return summary of learning log
    const summary = summarizeLearningLog();
    response.message = summary;
    response.action = { type: 'NONE', payload: {} };

    addToLearningLog({
      userInput,
      detectedIntent: intent,
      success: true,
      note: 'Returned learning log summary',
    });

    return NextResponse.json(response);
  }

  try {
    switch (intent) {
      case 'create_task': {
        // Parse title and priority from userInput (simple heuristic)
        // Example: "sukurk task login page with high priority"
        const titleMatch = userInput.match(/task\s+([^\n]+?)(?:\s+with|$)/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled Task';

        const priorityMatch = userInput.match(/priority\s+(low|medium|high)/i);
        const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';

        store.createTask({ title, priority: priority as 'low' | 'medium' | 'high' });

        response.message = `Task "${title}" created with priority ${priority}.`;
        response.action = {
          type: 'CREATE_TASK',
          payload: { title, priority: priority as 'low' | 'medium' | 'high' },
        };

        addToLearningLog({
          userInput,
          detectedIntent: intent,
          success: true,
          note: `Created task "${title}" with priority ${priority}`,
        });

        break;
      }

      case 'create_agent': {
        // Parse name and role from userInput (simple heuristic)
        // Example: "sukurk agentą Jonas role frontend"
        const nameMatch = userInput.match(/agent(?:ą|as)?\s+([^\s]+)(?:\s+role|$)/i);
        const name = nameMatch ? nameMatch[1].trim() : 'Unnamed Agent';

        const roleMatch = userInput.match(/role\s+(\w+)/i);
        const role = roleMatch ? roleMatch[1].trim() : 'general';

        store.createAgent({ name, role });

        response.message = `Agent "${name}" created with role ${role}.`;
        response.action = {
          type: 'CREATE_AGENT',
          payload: { name, role },
        };

        addToLearningLog({
          userInput,
          detectedIntent: intent,
          success: true,
          note: `Created agent "${name}" with role ${role}`,
        });

        break;
      }

      case 'question': {
        response.message = 'Atsakymas į jūsų klausimą: (dar nepalaikoma)';
        response.action = { type: 'NONE', payload: {} };

        addToLearningLog({
          userInput,
          detectedIntent: intent,
          success: true,
          note: 'Detected question, no action taken',
        });

        break;
      }

      case 'none_or_question':
      default: {
        response.message = 'Nesupratau jūsų užklausos. Prašome pabandyti dar kartą.';
        response.action = { type: 'NONE', payload: {} };

        addToLearningLog({
          userInput,
          detectedIntent: intent,
          success: false,
          note: 'No matching intent',
        });

        break;
      }
    }
  } catch (error) {
    response.message = 'Įvyko klaida apdorojant užklausą.';
    response.action = { type: 'NONE', payload: {} };

    addToLearningLog({
      userInput,
      detectedIntent: intent,
      success: false,
      note: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return NextResponse.json(response);
}
