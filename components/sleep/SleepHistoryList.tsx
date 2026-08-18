'use client';

import { useMemo, useState } from 'react';
import type { Locale, SleepSession } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepSessionService } from '@/lib/services/sleepSessionService';
import { useLocale, useMessages, type Messages } from '@/lib/i18n';
import { dateFmt, numberFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { formatSleepDuration } from './sleepService';

export type SleepHistoryListProps = {
  sessions: SleepSession[];
  /** `null` when no recorder resolved yet (or unavailable) — deletes fall back to `store` directly. */
  service: SleepSessionService | null;
  store: DataStore;
};

const HISTORY_STATES = new Set(['analyzed', 'failed']);

/** One line per finished night, newest first: date, duration + burden, or "Analysis failed". */
function nightSummary(session: SleepSession, locale: Locale, m: Messages['sleep']['history']): string {
  if (session.state === 'failed' || session.metrics === undefined) return m.failed;
  const duration = formatSleepDuration(session.metrics.recordingDurationMs, locale);
  const burden = numberFmt(locale).format(session.metrics.snoreBurden);
  const interrupted = session.interrupted === true ? ` · ${m.interrupted}` : '';
  return `${duration} · ${burden}${interrupted}`;
}

/**
 * Every analyzed/failed night, most recent first — per-night delete plus a
 * "Delete all snoring data" action, each behind its own confirm `Sheet`.
 *
 * Deletion is always available, even when `service` is `null` (no recorder
 * resolved on this device/browser, e.g. production web reviewing nights
 * imported from another device): it's a privacy requirement, and removing a
 * row never actually needs the recorder — an imported row's `clipPath`s
 * point at files that were never on THIS device to begin with, so they're
 * already dangling and there is nothing for a recorder to clean up. Prefer
 * `service.deleteSession`/`deleteAllSessions` when available (it also tries
 * to delete real, reachable clip files), falling back to the plain
 * `DataStore` removal otherwise.
 */
export function SleepHistoryList({ sessions, service, store }: SleepHistoryListProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const [pendingDelete, setPendingDelete] = useState<SleepSession | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const nights = useMemo(
    () =>
      sessions
        .filter((s) => HISTORY_STATES.has(s.state))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [sessions]
  );

  if (nights.length === 0) return null;

  async function handleDeleteNight() {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      if (service) {
        await service.deleteSession(pendingDelete.id);
      } else {
        await store.removeSleepSession(pendingDelete.id);
      }
      setPendingDelete(null);
    } catch (err) {
      console.error('Unsmoke: failed to delete a sleep session', err);
      showToast(m.common.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAll() {
    if (busy) return;
    setBusy(true);
    try {
      if (service) {
        await service.deleteAllSessions();
      } else {
        await store.clearSleepSessions();
      }
      setConfirmDeleteAll(false);
    } catch (err) {
      console.error('Unsmoke: failed to delete all snoring data', err);
      showToast(m.common.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.history.title}</h2>

      <div className="flex flex-col gap-2">
        {nights.map((session) => (
          <Card key={session.id} className="flex items-center justify-between gap-3 !p-4">
            <p className="text-[13px] leading-relaxed tabular-nums text-ink">
              {dateFmt(locale, { dateStyle: 'medium' }).format(new Date(session.startedAt))} ·{' '}
              {nightSummary(session, locale, m.sleep.history)}
            </p>
            <button
              type="button"
              onClick={() => setPendingDelete(session)}
              aria-label={m.sleep.history.delete}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.9]"
            >
              ✕
            </button>
          </Card>
        ))}
      </div>

      <Button variant="secondary" fullWidth onClick={() => setConfirmDeleteAll(true)}>
        {m.sleep.history.deleteAll}
      </Button>

      <Sheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={m.sleep.history.deleteNightSheet.title}
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">{m.sleep.history.deleteNightSheet.body}</p>
          <Button variant="secondary" fullWidth onClick={() => void handleDeleteNight()} disabled={busy}>
            {m.sleep.history.deleteNightSheet.confirm}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setPendingDelete(null)}>
            {m.sleep.history.deleteNightSheet.cancel}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title={m.sleep.history.deleteAllSheet.title}
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">{m.sleep.history.deleteAllSheet.body}</p>
          <Button variant="secondary" fullWidth onClick={() => void handleDeleteAll()} disabled={busy}>
            {m.sleep.history.deleteAllSheet.confirm}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirmDeleteAll(false)}>
            {m.sleep.history.deleteAllSheet.cancel}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

export default SleepHistoryList;
