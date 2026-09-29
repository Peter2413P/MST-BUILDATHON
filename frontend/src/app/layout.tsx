import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'AgentMesh — Autonomous AI Agent Orchestration Platform',
  description: 'Deconstruct high-level goals into parallel autonomous workflows verified on-chain with MSTC micropayments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mockMode = process.env.MOCK_MODE === 'true';
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
        {/* Anti-flicker: apply theme class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('ag-theme');
              var el = document.documentElement;
              if (t === 'dark') {
                el.classList.remove('light');
                el.classList.add('dark');
              } else {
                el.classList.remove('dark');
                el.classList.add('light');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen antialiased bg-[#f2fdeb] dark:bg-[#0B0D0A] text-[#121511] dark:text-[#F5F7F2]">
        <Providers>
          <Nav />
          {mockMode && (
            <div className="fixed top-16 left-0 md:left-[240px] right-0 z-30 bg-amber-400 text-black text-[11px] font-mono font-bold text-center py-1 tracking-widest">
              ⚠ MOCK MODE ACTIVE — zero real API calls · set MOCK_MODE=false to disable
            </div>
          )}
          <div className="md:pl-[240px] w-full min-h-screen">
            <main className={mockMode ? 'pt-24' : 'pt-16'}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
