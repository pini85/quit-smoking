'use client';

import { useServiceWorker } from '@/lib/hooks/useServiceWorker';
import { useMessages } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';

export type UpdateToastProps = {
  /**
   * Hides the banner without unregistering anything. Set on the immersive
   * routes: nothing interrupts someone mid-craving, and the banner would have
   * no tab bar to sit above there anyway.
   */
  suppressed?: boolean;
};

/**
 * The service worker's only piece of UI. Mounted once, from `AppShell`, so the
 * registration in `useServiceWorker` survives every route change.
 *
 * Sits one lane above `<Toaster/>` (which owns `bottom + 96px`) so a passing
 * toast never lands on top of a banner that is waiting for a tap.
 */
export function UpdateToast({ suppressed = false }: UpdateToastProps) {
  const { updateReady, applyUpdate } = useServiceWorker();
  const m = useMessages();

  if (!updateReady || suppressed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+152px)] z-50 flex justify-center px-5"
    >
      <div className="animate-fade-in flex w-full max-w-md items-center justify-between gap-3 rounded-button border border-border bg-surface-raised px-4 py-3 shadow-lg">
        <span className="text-sm text-ink">{m.chrome.updateReady}</span>
        <Button variant="secondary" onClick={applyUpdate}>
          {m.chrome.refresh}
        </Button>
      </div>
    </div>
  );
}

export default UpdateToast;
