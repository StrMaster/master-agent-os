'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Sveikas. Aš esu Master Agent. Kuo galiu padėti?',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    const nextMessages = [...messages, userMessage, assistantPlaceholder];

    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          messages: nextMessages
            .filter((m) => !(m.id === assistantId && m.content === ''))
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Nepavyko gauti atsakymo');
      }

      if (!response.body) {
        throw new Error('Nėra response stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        fullText += decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: fullText } : msg
          )
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: fullText.trim() || 'Atsiprašau, atsakymas tuščias.',
              }
            : msg
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Įvyko nežinoma klaida';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Klaida: ${message}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Master Agent</h1>
            <p className="text-sm text-white/60">Gyvas valdymo pokalbis</p>
          </div>

          <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
            {isLoading ? 'Thinking…' : 'Online'}
          </div>
        </div>
      </header>

      <main
        ref={listRef}
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-36"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  isUser
                    ? 'bg-white text-black'
                    : 'border border-white/10 bg-white/5 text-white'
                }`}
              >
                <div className="mb-1 text-[11px] uppercase tracking-wide opacity-60">
                  {isUser ? 'You' : 'Master Agent'}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content || (isLoading && !isUser ? '…' : '')}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="pointer-events-auto mx-auto w-full max-w-4xl px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3 shadow-2xl"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rašyk žinutę Master Agent..."
              rows={1}
              autoComplete="off"
              autoCorrect="on"
              spellCheck
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-11 rounded-xl bg-white px-4 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? '...' : 'Siųsti'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}