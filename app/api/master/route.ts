'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';

const allowedActionTypes = new Set(['CREATE_TASK', 'CREATE_AGENT', 'UPDATE_TASK_STATUS', 'NONE']);

// Helper to create safe NONE action response
function safeNoneResponse(): MasterResponse {
  return {
    message: 'Atpažinta užklausa, bet saugaus veiksmo vykdyti negaliu.',
    action: { type: 'NONE', payload: {} },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Simulate processing and generating a response
    // For demonstration, assume body contains an action
    // In real usage, this would be replaced with actual logic

    // Extract action from request or generate default
    let action: MasterAction | undefined = body.action;

    // If no action provided, respond with NONE
    if (!action || !action.type) {
      return NextResponse.json(safeNoneResponse());
    }

    // Validate action type
    if (!allowedActionTypes.has(action.type)) {
      return NextResponse.json(safeNoneResponse());
    }

    // If action type is UPDATE_TASK_STATUS, transform it to a supported action
    // Since UPDATE_TASK_STATUS is allowed but not defined in MasterAction, we map it to NONE
    // or handle accordingly. Here we just allow it to pass through.

    // For demonstration, respond with the action and a success message
    return NextResponse.json({
      message: 'Veiksmas priimtas ir apdorotas.',
      action,
    });
  } catch (error) {
    return NextResponse.json(safeNoneResponse());
  }
}
