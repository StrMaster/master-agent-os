'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ChatMessage,
  MasterAction,
  MasterResponse,
} from '@/lib/master-types';
import { useMasterStore } from '@/lib/master-store';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Sveikas. Aš esu Master Agent. Galiu kurti tasks ir agents.',
    },
  ]);

  const {
  tasks,
  agents,
  createTask,
  createAgent,
  sendToExecution,
  breakdownTask,
} = useMasterStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, tasks, agents]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function applyAction(action: MasterAction) {
  console.log('APPLY ACTION', action);

  switch (action.type) {
    case 'BREAKDOWN_TASK': {
  breakdownTask({
    taskTitle: action.payload.taskTitle,
    subtasks: action.payload.subtasks,
  });
  break;
}
    case 'CREATE_TASK': {
  createTask({
    title: action.payload.title,
    priority: action.payload.priority,
  });

  const lower = action.payload.title.toLowerCase();

  let subtasks: string[] = [
    'Define scope',
    'Create first UI version',
    'Connect core logic',
    'Test key flows',
  ];

  if (lower.includes('login')) {
    subtasks = [
      'Create login page layout',
      'Add email and password inputs',
      'Add validation states',
      'Connect authentication flow',
      'Add loading and error handling',
    ];
  }

  if (lower.includes('dashboard')) {
    subtasks = [
      'Create dashboard layout',
      'Add summary cards',
      'Connect shared data source',
      'Add responsive behavior',
      'Polish visual hierarchy',
    ];
  }

  breakdownTask({
    taskTitle: action.payload.title,
    subtasks,
  });

  break;
}

    case 'CREATE_AGENT': {
      createAgent({
        name: action.payload.name,
        role: action.payload.role,
      });
      break;
    }

    case 'SEND_TO_EXECUTION': {
      sendToExecution({
        targetType: action.payload.targetType,
      });
      break;
    }

    case 'NONE':
    default:
      break;
  }
}

  async function sendMessage() {
    const content = input.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const payloadMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: payloadMessages,
        }),
      });

      const data = (await response.json()) as MasterResponse;
      console.log('MASTER RESPONSE', data);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      applyAction(data.action);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Įvyko klaida bandant susisiekti su Master API.',
        },
      ]);
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
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Master Agent</h1>
            <p className="text-sm text-white/60">Action system MVP</p>
          </div>

          <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
            {isLoading ? 'Thinking…' : 'Online'}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[1.5fr_1fr]">
        <main className="flex min-h-[70vh] flex-col rounded-2xl border border-white/10 bg-white/5">
          <div
            ref={listRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-32"
          >
            {messages.map((message) => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      isUser
                        ? 'bg-white text-black'
                        : 'border border-white/10 bg-neutral-900 text-white'
                    }`}
                  >
                    <div className="mb-1 text-[11px] uppercase tracking-wide opacity-60">
                      {isUser ? 'You' : 'Master Agent'}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 p-3">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pvz: sukurk task login page arba sukurk agentą testavimui"
                rows={1}
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
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Tasks</h2>
              <span className="text-xs text-white/50">{tasks.length}</span>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-white/50">Kol kas taskų nėra.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                  >
                    <div className="font-medium">{task.title}</div>
                    <div className="mt-1 text-xs text-white/60">
                      Priority: {task.priority} · Status: {task.status}
                    {task.subtasks?.length > 0 && (
  <div className="mt-3 space-y-2">
    {task.subtasks?.map((subtask) => (
      <div
        key={subtask.id}
        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70"
      >
        {subtask.done ? '✓' : '•'} {subtask.title}
      </div>
    ))}
  </div>
)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Agents</h2>
              <span className="text-xs text-white/50">{agents.length}</span>
            </div>

            <div className="space-y-3">
              {agents.length === 0 ? (
                <p className="text-sm text-white/50">Kol kas agentų nėra.</p>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="mt-1 text-xs text-white/60">
                      Role: {agent.role} · Status: {agent.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}