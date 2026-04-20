import OpenAI from 'openai';

export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type IncomingMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body?.message ?? '');
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (!message.trim()) {
      return new Response('Missing message', { status: 400 });
    }

    const conversation: IncomingMessage[] = messages.filter(isIncomingMessage);

    const stream = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: `
Tu esi Master Agent OS branduolys.
Tavo tikslas:
- aiškiai atsakyti
- būti trumpam, praktiškam ir veiksmingam
- kai reikia, siūlyti kitą geriausią veiksmą
- išlaikyti pokalbį app stiliaus, ne per daug formaliai
          `.trim(),
        },
        ...conversation,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(event.delta));
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Streaming error';
          controller.enqueue(encoder.encode(`\n[Klaida: ${message}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';

    return new Response(message, { status: 500 });
  }
}