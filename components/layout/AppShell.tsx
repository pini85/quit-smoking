'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { TabBar } from './TabBar';
import { UpdateToast } from './UpdateToast';
import { SessionRecovery } from '@/components/craving/SessionRecovery';
import { AchievementTicker } from '@/components/providers/AchievementTicker';

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
      {/* Mounted here rather than inside AppGate so it survives every route
          change; it no-ops on /craving, where the session is still live. */}
      <SessionRecovery />
      {/* Renders nothing; unlocks time-based badges on whatever screen the
          user is actually on, instead of waiting for the next write. */}
      <AchievementTicker />
      {/* Always mounted so the service worker registers on any entry route;
          the banner itself stays out of the way on the immersive ones. */}
      <UpdateToast suppressed={immersive} />
    </>
  );
}

export default AppShell;
