import type { Metadata } from 'next';

import Link from 'next/link';

import './globals.css';

import { MasterStoreProvider } from '@/lib/master-store';

export const metadata: Metadata = {

  title: 'Master Agent OS',

  description: 'AI orchestration workspace',

};

const navItems = [

  { href: '/', label: 'Dashboard' },

  { href: '/chat', label: 'Master Chat' },

  { href: '/agents', label: 'Agents' },

  { href: '/tasks', label: 'Tasks' },

  { href: '/execution', label: 'Execution' },

  { href: '/changes', label: 'Changes' },

];

export default function RootLayout({

  children,

}: Readonly<{

  children: React.ReactNode;

}>) {

  return (

    <html lang="en">

      <body className="bg-neutral-950 text-white">

        <MasterStoreProvider>

          <div className="flex min-h-screen overflow-x-hidden bg-neutral-950 text-white">

            {/* Desktop sidebar */}

            <aside className="hidden w-64 shrink-0 border-r border-white/10 p-4 md:block">

              <div className="mb-6">

                <h1 className="text-xl font-bold tracking-wide">MASTER AGENT OS</h1>

              </div>

              <nav className="space-y-2">

                {navItems.map((item) => (

                  <Link

                    key={item.href}

                    href={item.href}

                    className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"

                  >

                    {item.label}

                  </Link>

                ))}

              </nav>

            </aside>

            {/* Main content */}

            <main className="min-w-0 flex-1">

              {/* Mobile top bar */}

              <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/95 backdrop-blur md:hidden">

                <div className="px-4 py-3">

                  <div className="mb-3">

                    <h1 className="text-lg font-bold tracking-wide">MASTER AGENT OS</h1>

                  </div>

                  <nav className="flex flex-wrap gap-2">

                    {navItems.map((item) => (

                      <Link

                        key={item.href}

                        href={item.href}

                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"

                      >

                        {item.label}

                      </Link>

                    ))}

                  </nav>

                </div>

              </div>

              <div className="min-w-0 px-4 py-4 md:px-6 md:py-6">{children}</div>

            </main>

          </div>

        </MasterStoreProvider>

      </body>

    </html>

  );

}