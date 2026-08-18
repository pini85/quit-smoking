'use client';

import type { Preferences } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type InstallCardProps = {
  preferences: Preferences | null;
  store: DataStore;
};

async function dismiss(preferences: Preferences | null, store: DataStore): Promise<void> {
  try {
    const now = new Date();
    const base = preferences ?? defaultPreferences(now);
    await store.savePreferences({ ...base, dismissedInstallHint: true, updatedAt: toLocalIso(now) });
  } catch (err) {
    console.error('Unsmoke: failed to dismiss install hint', err);
  }
}

/**
 * Browser-tab-only nudge to install the PWA. Renders nothing once the app is
 * already running standalone, once dismissed, or in a browser that offers
 * neither a native install prompt (Android/desktop Chrome) nor iOS's manual
 * "Add to Home Screen" path.
 */
export function InstallCard({ preferences, store }: InstallCardProps) {
  const { platform, isStandalone, canPromptInstall, promptInstall } = useInstallPrompt();

  if (isStandalone || preferences?.dismissedInstallHint) return null;
  if (!canPromptInstall && platform !== 'ios') return null;

  async function handleInstallClick() {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('Installed');
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Install Unsmoke</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {canPromptInstall
              ? 'Add it to your home screen for one-tap access — no app store needed.'
              : 'Tap Share, then "Add to Home Screen" — no app store needed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismiss(preferences, store)}
          aria-label="Dismiss install hint"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.9]"
        >
          ✕
        </button>
      </div>

      {canPromptInstall ? <Button onClick={() => void handleInstallClick()}>Install</Button> : null}
    </Card>
  );
}

export default InstallCard;
