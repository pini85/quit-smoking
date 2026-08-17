'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Placeholder for the immersive "answer your brain" flow. Listed in
 * `AppShell`'s `IMMERSIVE_ROUTES`, so it renders with no tab bar — which
 * also means this stub has to carry its own way out, since nothing links
 * here yet and the browser's back button is the only other exit.
 */
export default function BrainPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">Your brain</h1>

      <EmptyState>Coming together. Nothing to do here yet.</EmptyState>

      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center self-center text-[14px] font-medium text-primary-strong"
      >
        Back to today
      </Link>
    </div>
  );
}
