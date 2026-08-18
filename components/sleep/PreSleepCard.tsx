'use client';

import { useEffect, useState } from 'react';
import type { Preferences, SleepSession } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepSessionService } from '@/lib/services/sleepSessionService';
import type {
  RecorderAvailability,
  RecorderPermissionState,
  RecorderStatus,
  SleepRecorder,
} from '@/lib/recorder/types';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { deleteClipsAndUpdateSessions } from './sleepService';

export type PreSleepCardProps = {
  recorder: SleepRecorder;
  service: SleepSessionService;
  store: DataStore;
  preferences: Preferences | null;
  sessions: SleepSession[];
  availability: RecorderAvailability;
  onStarted: (status: RecorderStatus) => void;
};

/**
 * The evening state: placement/mic/charger tips, the disclaimer, the
 * keep-clips preference (offering to delete already-saved clips when turned
 * off), and the Start button — which requests microphone permission first
 * and shows an honest inline notice on a denial rather than starting anyway.
 *
 * Notification permission is read (never requested on its own) and reported
 * separately, because the two denials mean completely different things: no
 * microphone means no recording at all, while no notification permission just
 * means the ongoing-recording notification stays hidden. The elsewhere-shown
 * "Android will continue monitoring" reassurance and the notification's Stop
 * action are what that denial actually changes, so it is named rather than
 * left as a surprise.
 */
export function PreSleepCard({
  recorder,
  service,
  store,
  preferences,
  sessions,
  availability,
  onStarted,
}: PreSleepCardProps) {
  const m = useMessages();
  const [starting, setStarting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [confirmDisableClips, setConfirmDisableClips] = useState(false);
  const [notifications, setNotifications] = useState<RecorderPermissionState | null>(null);

  // `permissions()` never prompts (it is the plugin's checkPermissions), so
  // reading it on mount is safe and shows the note before Start rather than
  // only after. Failures are ignored: an unreadable permission state is not
  // worth an error surface, it just leaves the note off.
  useEffect(() => {
    let cancelled = false;
    void recorder.permissions().then(
      (result) => {
        if (!cancelled) setNotifications(result.notifications);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [recorder]);

  const keepClips = preferences?.keepSnoreClips === true;
  const clipPaths = sessions.flatMap(
    (s) => s.events?.flatMap((e) => (e.clipPath !== undefined ? [e.clipPath] : [])) ?? []
  );

  async function savePreference(next: boolean) {
    const now = new Date();
    const base = preferences ?? defaultPreferences(now);
    try {
      await store.savePreferences({ ...base, keepSnoreClips: next, updatedAt: toLocalIso(now) });
    } catch (err) {
      console.error('Unsmoke: failed to save the keep-clips preference', err);
      showToast(m.common.saveFailed);
    }
  }

  function handleKeepClipsChange(next: boolean) {
    if (!next && clipPaths.length > 0) {
      setConfirmDisableClips(true);
      return;
    }
    void savePreference(next);
  }

  async function handleDeleteExistingClips() {
    setConfirmDisableClips(false);
    await savePreference(false);
    try {
      await deleteClipsAndUpdateSessions(recorder, store, sessions, clipPaths);
    } catch (err) {
      console.error('Unsmoke: failed to delete existing snore clips', err);
    }
  }

  async function handleKeepExistingClips() {
    setConfirmDisableClips(false);
    await savePreference(false);
  }

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      let permission = await recorder.permissions();
      if (permission.microphone !== 'granted') {
        permission = await recorder.requestPermissions();
      }
      // Whatever the prompt settled on, the note below reflects it from here on.
      setNotifications(permission.notifications);
      if (permission.microphone !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);

      const session = await service.startMonitoring(new Date());
      onStarted({
        phase: 'recording',
        sessionId: session.id,
        startedAtMs: new Date(session.startedAt).getTime(),
      });
    } catch (err) {
      console.error('Unsmoke: failed to start snore monitoring', err);
      showToast(m.common.saveFailed);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.preSleep.title}</h2>

      <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-muted">
        <li>• {m.sleep.preSleep.tips.placement}</li>
        <li>• {m.sleep.preSleep.tips.mic}</li>
        <li>• {m.sleep.preSleep.tips.charger}</li>
      </ul>

      <p className="text-[12px] leading-relaxed text-ink-faint">{m.sleep.disclaimer}</p>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">{m.sleep.preSleep.keepClips.title}</span>
          <div role="radiogroup" aria-label={m.sleep.preSleep.keepClips.title} className="flex gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={!keepClips}
              onClick={() => handleKeepClipsChange(false)}
              className={`min-h-11 rounded-button border px-3 text-[13px] font-medium ${
                !keepClips ? 'border-primary bg-surface text-ink' : 'border-border bg-surface text-ink-muted'
              }`}
            >
              {m.sleep.preSleep.keepClips.toggleOff}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={keepClips}
              onClick={() => handleKeepClipsChange(true)}
              className={`min-h-11 rounded-button border px-3 text-[13px] font-medium ${
                keepClips ? 'border-primary bg-surface text-ink' : 'border-border bg-surface text-ink-muted'
              }`}
            >
              {m.sleep.preSleep.keepClips.toggleOn}
            </button>
          </div>
        </div>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          {keepClips ? m.sleep.preSleep.keepClips.on : m.sleep.preSleep.keepClips.off}
        </p>
        <p className="text-[12px] leading-relaxed text-ink-faint">{m.sleep.preSleep.keepClips.privacyNote}</p>
      </div>

      {permissionDenied ? (
        <div className="rounded-card bg-caution/10 px-3 py-2">
          <p className="text-[13px] font-medium text-caution">{m.sleep.preSleep.permissionDenied.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            {m.sleep.preSleep.permissionDenied.body}
          </p>
        </div>
      ) : null}

      {availability === 'native' && notifications === 'denied' ? (
        <p className="text-[12px] leading-relaxed text-ink-faint">
          {m.sleep.preSleep.notificationsDenied}
        </p>
      ) : null}

      {availability === 'web-dev' ? (
        <p className="text-[12px] leading-relaxed text-ink-faint">{m.sleep.webDevNote}</p>
      ) : null}

      <Button fullWidth onClick={() => void handleStart()} disabled={starting}>
        {starting ? m.sleep.preSleep.starting : m.sleep.preSleep.start}
      </Button>

      <Sheet
        open={confirmDisableClips}
        onClose={() => setConfirmDisableClips(false)}
        title={m.sleep.preSleep.deleteClipsSheet.title}
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">{m.sleep.preSleep.deleteClipsSheet.body}</p>
          <Button variant="secondary" fullWidth onClick={() => void handleDeleteExistingClips()}>
            {m.sleep.preSleep.deleteClipsSheet.deleteExisting}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => void handleKeepExistingClips()}>
            {m.sleep.preSleep.deleteClipsSheet.keepExisting}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export default PreSleepCard;
