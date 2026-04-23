'use server';

import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

// Define the allowed action types as a union of string literals
const allowedActionTypes = [
  'BREAKDOWN_TASK',
  'CREATE_TASK',
  'CREATE_AGENT',
  'SEND_TO_EXECUTION',
  'NONE',
] as const;

type AllowedActionType = typeof allowedActionTypes[number];

// Helper function to validate action type
function isAllowedActionType(type: any): type is AllowedActionType {
  return allowedActionTypes.includes(type);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate that action.type is a strict union type
    if (!body || typeof body.action !== 'object' || body.action === null) {
      return NextResponse.json({ error: 'Invalid action object' }, { status: 400 });
    }

    const action = body.action;

    if (!isAllowedActionType(action.type)) {
      return NextResponse.json({ error: `Invalid action type: ${action.type}` }, { status: 400 });
    }

    // Proceed with handling the action
    // For demonstration, just echo back the action
    const response: MasterResponse = {
      message: `Action received: ${action.type}`,
      action: action as MasterAction,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse request' }, { status: 400 });
  }
}
