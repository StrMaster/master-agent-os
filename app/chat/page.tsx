import MasterAgentChat from "../components/MasterAgentChat";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Master Chat</h1>

          <p className="mt-2 text-sm text-white/60">
            Prompt-driven autonomous engineering interface.
          </p>
        </div>

        <MasterAgentChat />
      </div>
    </main>
  );
}