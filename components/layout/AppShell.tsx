'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { TabBar } from './TabBar';

/** Full-bleed, single-purpose routes: no tab bar to pull attention away. */
const IMMERSIVE_ROUTES = ['/craving', '/welcome'];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = IMMERSIVE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <>
      <main
        className={`mx-auto w-full max-w-md flex-1 px-5 pt-[env(safe-area-inset-top)] ${
          immersive ? 'pb-[calc(env(safe-area-inset-bottom)+24px)]' : 'pb-28'
        }`}
      >
        {children}
      </main>
      {immersive ? null : <TabBar />}
    </>
  );
}

export default AppShell;
