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
          <div className="flex min-h-screen overflow-x-hidden bg-neutral-950 text-white">
            
            {/* Sidebar */}
            <aside className="hidden w-64 border-r border-white/10 p-4 md:block">
              <div className="mb-6">
                <h1 className="text-lg font-semibold">MASTER AGENT OS</h1>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <main className="min-w-0 flex-1 p-4 md:p-6">
              {children}
            </main>
          </div>
        </MasterStoreProvider>
      </body>
    </html>
  );
}