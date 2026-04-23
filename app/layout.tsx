import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { MasterStoreProvider } from "@/lib/master-store";
import { useState } from "react";

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
  { href: '/changes', label: 'Changes' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <body>
        <MasterStoreProvider>
          <div className="flex min-h-screen bg-neutral-950 text-white overflow-x-hidden">
            {/* Mobile sidebar backdrop */}
            <div
              className={`fixed inset-0 z-10 bg-black bg-opacity-50 transition-opacity sm:hidden ${
                sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              aria-hidden={!sidebarOpen}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside
              className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-white/10 bg-neutral-950 p-4 transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 sm:flex-shrink-0 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="mb-6 flex items-center justify-between sm:justify-start">
                <h1 className="text-lg font-semibold">MASTER AGENT OS</h1>
                {/* Close button for mobile */}
                <button
                  type="button"
                  className="sm:hidden rounded-md p-1 hover:bg-white/10"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-6 w-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white break-words"
                    onClick={() => setSidebarOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* Content area */}
            <main className="flex-1 min-w-0 px-4 py-6 sm:ml-64">
              {/* Mobile toggle button */}
              <button
                type="button"
                className="fixed top-4 left-4 z-30 inline-flex items-center justify-center rounded-md bg-neutral-900 p-2 text-white hover:bg-white/10 sm:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div className="max-w-full space-y-4">
                {children}
              </div>
            </main>
          </div>
        </MasterStoreProvider>
      </body>
    </html>
  );
}
