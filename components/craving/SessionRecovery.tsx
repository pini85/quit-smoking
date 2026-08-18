'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { CravingOutcome, CravingSession } from '@/domain/types';
import { classifyOpenSessions, finalizeAbandoned } from '@/lib/services/sessionFinalizer';
import { sweepAchievements } from '@/lib/services/achievementSweep';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { useMessages } from '@/lib/i18n';
import { showToast } from '@/components/ui/Toast';
import { toLocalIso } from '@/lib/utils/iso';
import { ResumeSessionSheet } from './ResumeSessionSheet';

const CRAVING_PATH = '/craving';

const EMPTY: CravingSession[] = [];

/**
 * The safety net for sessions nobody ever closed. Mounted once in `AppShell`.
 *
 * Rows go on disk the moment an intensity is tapped, which means a user who
 * did exactly what we asked (put the phone down) leaves an open row behind.
 * On any screen OTHER than the craving flow itself, stale rows are closed as
 * 'unresolved' and — if one is recent enough to actually remember — a single
 * sheet asks how it went.
 *
 * The `/craving` guard is the important one: running this while a session is
 * in progress would finalize the very row the user is still filling in.
 *
 * Which sessions are stale is DERIVED during render (from the store snapshot
 * and the minute clock) rather than mirrored into state; the one effect here
 * exists purely to push those decisions out to persistence.
 */
export function SessionRecovery() {
  const { data, store } = useAppData();
  const m = useMessages();
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow(60_000);
  // Sessions this mount has stopped asking about — either because the user
  // answered (the store write is async, so without this the sheet would
  // linger for a beat after the tap) or because they chose to go and have a
  // new craving instead, which must not re-latch the sheet during the render
  // or two before the route change lands.
  const [silencedIds, setSilencedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const writingRef = useRef(false);

  const inFlow = pathname === CRAVING_PATH || pathname.startsWith(`${CRAVING_PATH}/`);
  // `now.getTime() === 0` is `useNow`'s stable pre-subscription snapshot; the
  // real clock lands on the very next render, and classifying against the
  // epoch in between would call every session "fresh".
  const ready = data.status === 'ready' && !inFlow && now.getTime() > 0;

  const open = useMemo(
    () => (ready ? data.cravings.filter((c) => c.outcome === null) : EMPTY),
    [ready, data.cravings]
  );

  const { resume, finalize } = useMemo(() => classifyOpenSessions(open, now), [open, now]);

  /**
   * Once the question is on screen it stays on screen.
   *
   * `resume` is recomputed every minute, so a session that was 14 minutes old
   * when the sheet opened becomes "stale" a minute later and would otherwise
   * be finalized out from under the user — the sheet vanishing mid-read, and
   * their answer thrown away in favour of 'unresolved'. Sticking the id means
   * the classifier decides when to ASK, and only the user decides when to
   * stop asking. Cleared when they answer, or when they head into the flow.
   */
  const [stickyId, setStickyId] = useState<string | null>(null);

  const session = useMemo(() => {
    if (!ready || stickyId === null || silencedIds.includes(stickyId)) return null;
    return data.cravings.find((c) => c.id === stickyId && c.outcome === null) ?? null;
  }, [ready, stickyId, silencedIds, data.cravings]);

  // Adjusting state during render, the way React documents it for derived
  // state: no effect, no extra commit, and the re-render happens before
  // anything is painted.
  const nextStickyId = session !== null ? stickyId : ready ? (resume?.id ?? null) : null;
  if (nextStickyId !== stickyId) {
    setStickyId(nextStickyId);
  }

  // The session being asked about is exempt: it is the user's to close, not
  // the timer's, for as long as the sheet is up.
  const toFinalize = useMemo(
    () => finalize.filter((s) => s.id !== stickyId),
    [finalize, stickyId]
  );

  useEffect(() => {
    if (toFinalize.length === 0 || writingRef.current) return;
    writingRef.current = true;
    void (async () => {
      try {
        for (const stale of toFinalize) {
          await store.updateCraving(finalizeAbandoned(stale));
        }
      } catch (error) {
        // Nothing user-facing: these rows are being closed on the user's
        // behalf, and the next app open simply tries again.
        console.error('Unsmoke: failed to finalize abandoned craving sessions', error);
      } finally {
        writingRef.current = false;
      }
    })();
  }, [toFinalize, store]);

  if (session === null) return null;

  async function resolve(outcome: CravingOutcome) {
    if (session === null || busy) return;
    setBusy(true);
    try {
      // `finalIntensity` stays absent by design — see ResumeSessionSheet.
      await store.updateCraving({ ...session, outcome, endedAt: toLocalIso(new Date()) });
    } catch (error) {
      console.error('Unsmoke: failed to save resumed craving outcome', error);
      showToast(m.common.saveFailed);
      setBusy(false);
      // Sheet stays open with the question intact.
      return;
    }
    setSilencedIds((prev) => [...prev, session.id]);
    setBusy(false);
    sweepAchievements(store).catch((error: unknown) => {
      console.error('Unsmoke: failed to sweep achievements', error);
    });
  }

  function dismiss() {
    if (session === null || busy) return;
    // Best-effort: closing the sheet is the user's answer, and if the write
    // fails the row is simply still open for the finalizer next time.
    setSilencedIds((prev) => [...prev, session.id]);
    store
      .updateCraving({ ...session, outcome: 'unresolved', endedAt: toLocalIso(new Date()) })
      .catch((error: unknown) => {
        console.error('Unsmoke: failed to dismiss craving session', error);
      });
  }

  function startNewCraving() {
    if (session === null) return;
    // Deliberately writes NOTHING to the old row: it stays open and ages out
    // through the 15-minute finalizer, which is the honest record of what
    // happened. The only thing that matters right now is that the user is
    // one tap from help instead of three.
    setSilencedIds((prev) => [...prev, session.id]);
    router.push(CRAVING_PATH);
  }

  return (
    <ResumeSessionSheet
      session={session}
      now={now}
      busy={busy}
      onResolve={(outcome) => void resolve(outcome)}
      onDismiss={dismiss}
      onNewCraving={startNewCraving}
    />
  );
}

export default SessionRecovery;
