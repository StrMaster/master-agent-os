'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterResponse } from '@/lib/master-types';

// Helper to clean task title by removing common prefixes and translating to English
function cleanTitle(rawTitle: string): string {
  let title = rawTitle.trim();

  // Remove common prefixes in Lithuanian and English
  const prefixes = [
    /^sukurk task:\s*/i,
    /^create task:\s*/i,
    /^sukurk užduotį:\s*/i,
    /^kurti užduotį:\s*/i,
    /^kurti taską:\s*/i,
    /^sukurk užduotį:\s*/i,
  ];

  for (const prefix of prefixes) {
    if (prefix.test(title)) {
      title = title.replace(prefix, '');
      break;
    }
  }

  // Simple keyword-based English translations for Lithuanian words
  // Only for demonstration, can be extended
  const translations: Record<string, string> = {
    'pagerinti': 'improve',
    'mobile': 'mobile',
    'navigation': 'navigation',
    'prisijungimo': 'login',
    'puslapį': 'page',
    'pagrindinį': 'main',
    'dashboard': 'dashboard',
    'vartotojo': 'user',
    'sąsaja': 'interface',
    'klaidų': 'errors',
    'taisymas': 'fix',
    'patobulinimas': 'enhancement',
  };

  // Replace Lithuanian words with English equivalents if found
  const words = title.split(/\s+/).map((word) => translations[word.toLowerCase()] ?? word);

  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Generate developer-focused actionable steps based on task title
function generateSteps(title: string): string[] {
  const lower = title.toLowerCase();

  // Detect if task is UI or mobile related
  const isMobileOrUI = ['mobile', 'ui', 'user interface', 'navigation', 'layout', 'responsive', 'sidebar', 'dashboard', 'page'].some(keyword => lower.includes(keyword));

  if (isMobileOrUI) {
    return [
      'Analyze current mobile layout issues',
      'Fix sidebar visibility and toggle behavior',
      'Prevent horizontal overflow (overflow-x hidden)',
      'Improve responsive Tailwind classes (sm, md, lg)',
      'Test on real mobile screen sizes',
    ];
  }

  // Backend/API related
  if (['api', 'auth', 'backend', 'server', 'database', 'db'].some(k => lower.includes(k))) {
    return [
      'Define API endpoints',
      'Implement request handlers',
      'Add validation and authentication checks',
      'Handle errors and edge cases',
      'Write integration tests',
    ];
  }

  // QA/Test related
  if (['test', 'qa', 'validation', 'bug', 'check'].some(k => lower.includes(k))) {
    return [
      'Define detailed test cases',
      'Cover happy path scenarios',
      'Cover edge cases and error states',
      'Validate error handling and recovery',
      'Document expected behavior and results',
    ];
  }

  // Default generic developer steps
  return [
    'Define scope and requirements',
    'Implement core functionality',
    'Write unit and integration tests',
    'Perform code review and refactoring',
    'Deploy and monitor in staging environment',
  ];
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Extract task title from input messages or direct input
    let rawTitle = '';

    if (Array.isArray(json.messages)) {
      // Find last user message content
      const userMsg = [...json.messages].reverse().find(m => m.role === 'user');
      if (userMsg) rawTitle = userMsg.content;
    } else if (typeof json.title === 'string') {
      rawTitle = json.title;
    }

    if (!rawTitle) {
      return NextResponse.json<MasterResponse>({
        message: 'No task title provided.',
        action: { type: 'NONE' },
      });
    }

    const cleanedTitle = cleanTitle(rawTitle);
    const steps = generateSteps(cleanedTitle);

    const message = `Task: ${cleanedTitle}\n\nSteps:\n- ${steps.join('\n- ')}`;

    const action = {
      type: 'CREATE_TASK',
      payload: {
        title: cleanedTitle,
        priority: 'medium',
      },
    };

    return NextResponse.json<MasterResponse>({
      message,
      action,
    });
  } catch (error) {
    return NextResponse.json<MasterResponse>({
      message: 'Failed to process request.',
      action: { type: 'NONE' },
    });
  }
}
