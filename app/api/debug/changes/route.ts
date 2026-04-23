import { NextResponse } from 'next/server';

// Mocked latest proposed changes data
// In real scenario, this should be replaced with actual data source or store
const latestProposal = {
  summary: 'Refactor authentication flow and add new login UI',
  branchName: 'feature/auth-refactor',
  commitMessage: 'feat(auth): refactor login flow and UI improvements',
  changes: [
    {
      filePath: 'components/LoginForm.tsx',
      content: 'import React from \"react\";\n\nexport default function LoginForm() {\n  return <form>Login Form</form>;\n}\n'
    },
    {
      filePath: 'lib/auth.ts',
      content: 'export async function login() {\n  // new login logic\n}\n'
    }
  ]
};

export async function GET() {
  return NextResponse.json(latestProposal);
}
