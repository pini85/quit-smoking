'use client';

import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Placeholder for the Freedom screen (belief map, daily booster, proof).
 * It exists so the fifth tab has somewhere to land instead of a 404 while
 * the real page is built; the shape here — page title, then content —
 * matches `app/progress/page.tsx` so the swap is a drop-in.
 */
export default function FreedomPage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">Freedom</h1>

      <EmptyState>Coming together. Nothing to do here yet.</EmptyState>
    </div>
  );
}
