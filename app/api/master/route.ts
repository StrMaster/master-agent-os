import { NextRequest, NextResponse } from 'next/server';
import { MasterAction, MasterResponse } from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Example: handle create agent action
  if (body.action === 'create-agent') {
    const { name, role } = body.payload;

    // Here would be logic to create agent in store or DB

    const response: MasterResponse = {
      message: `Agent "${name}" with role "${role}" created.`,
      action: {
        type: 'CREATE_AGENT',
        payload: { name, role },
      },
    };

    return NextResponse.json(response);
  }

  // Default response
  return NextResponse.json({ message: 'Unknown action', action: { type: 'NONE' } });
}
