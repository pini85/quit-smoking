'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppData } from '@/lib/hooks/useAppData';
import { Ring } from '@/components/ui/Ring';

const WELCOME_PATH = '/welcome';

/**
 * First-launch gate: keeps a profile-less visitor on `/welcome` and keeps a
 * fully-onboarded visitor off it. Mounted once, inside `AppShell`, wrapping
 * `children` (see `app/layout.tsx`).
 *
 * Both redirects fire from an effect, never during render (App Router
 * forbids calling `router.replace` mid-render, and the brief explicitly
 * calls for effect-only navigation). Each redirect is also self-limiting:
 * once `router.replace` lands, `pathname` changes on the next render and
 * the condition that triggered it stops being true, so there is no
 * ping-pong between `/welcome` and `/` in either direction.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { data } = useAppData();
  const pathname = usePathname();
  const router = useRouter();

  const needsOnboarding = data.status === 'ready' && data.profile === null;
  const isOnboarded = data.status === 'ready' && data.profile !== null;
  const onWelcome = pathname === WELCOME_PATH;

  const redirectingToWelcome = needsOnboarding && !onWelcome;
  const redirectingHome = isOnboarded && onWelcome;

  useEffect(() => {
    if (redirectingToWelcome) {
      router.replace(WELCOME_PATH);
    } else if (redirectingHome) {
      router.replace('/');
    }
  }, [redirectingToWelcome, redirectingHome, router]);

  const showSkeleton = data.status === 'loading' || redirectingToWelcome || redirectingHome;

  if (showSkeleton) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-hidden="true">
        <Ring mode="countdown" className="opacity-30" />
      </div>
    );
  }

  return <>{children}</>;
}

export default AppGate;
