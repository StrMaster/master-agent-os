import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { MasterStoreProvider } from "@/lib/master-store";

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
  return (
    <html lang="en">
      <body>
        <MasterStoreProvider>
          <div className="flex min-h-screen bg-neutral-950 text-white overflow-x-hidden">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 w-64 border-r border-white/10 bg-neutral-950 p-4 transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 sm:flex-shrink-0">
              <div className="mb-6">
                <h1 className="text-lg font-semibold">MASTER AGENT OS</h1>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white break-words"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0 px-4 py-6 sm:ml-64">
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
