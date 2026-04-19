import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Master Agent OS",
  description: "Interactive orchestration system",
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/chat", label: "Master Chat" },
  { href: "/agents", label: "Agents" },
  { href: "/tasks", label: "Tasks" },
  { href: "/execution", label: "Execution" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <div className="min-h-screen lg:flex">
          <aside className="hidden w-72 border-r border-zinc-800 bg-zinc-900/80 p-6 lg:block">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
                Master Agent OS
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                Control Center
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Goals, agents, tasks, and execution in one operating layer.
              </p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                System status
              </p>
              <p className="mt-3 text-sm text-zinc-300">Master Online</p>
              <p className="mt-1 text-sm text-zinc-400">Execution mode: Manual</p>
              <p className="mt-1 text-sm text-zinc-400">Environment: Local Dev</p>
            </div>
          </aside>

          <main className="min-h-screen flex-1">
            {children}
          </main>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}