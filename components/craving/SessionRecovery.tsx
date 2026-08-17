'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CravingOutcome, CravingSession } from '@/domain/types';
import { classifyOpenSessions, finalizeAbandoned } from '@/lib/services/sessionFinalizer';
import { sweepAchievements } from '@/lib/services/achievementSweep';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
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
 * exists purely to push those decisions out to persistence. That also means
 * a session crossing the 15-minute line while the app sits open is picked up
 * on the next tick, with no extra bookkeeping.
 */
export function SessionRecovery() {
  const { data, store } = useAppData();
  const pathname = usePathname();
  const now = useNow(60_000);
  // Ids the user has already answered for in this mount. The store write is
  // async, so without this the sheet would linger for a beat after the tap.
  const [answered, setAnswered] = useState<string[]>([]);
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

  useEffect(() => {
    if (finalize.length === 0 || writingRef.current) return;
    writingRef.current = true;
    void (async () => {
      try {
        for (const session of finalize) {
          await store.updateCraving(finalizeAbandoned(session));
        }
      } finally {
        writingRef.current = false;
      }
    })();
  }, [finalize, store]);

  const session = resume !== null && !answered.includes(resume.id) ? resume : null;
  if (session === null) return null;

  async function resolve(outcome: CravingOutcome) {
    if (session === null) return;
    setAnswered((prev) => [...prev, session.id]);
    // `finalIntensity` stays absent by design — see ResumeSessionSheet.
    await store.updateCraving({ ...session, outcome, endedAt: toLocalIso(new Date()) });
    await sweepAchievements(store);
  }

  function dismiss() {
    if (session === null) return;
    setAnswered((prev) => [...prev, session.id]);
    void store.updateCraving({
      ...session,
      outcome: 'unresolved',
      endedAt: toLocalIso(new Date()),
    });
  }

  return (
    <ResumeSessionSheet
      session={session}
      now={now}
      onResolve={(outcome) => void resolve(outcome)}
      onDismiss={dismiss}
    />
  );
}

export default SessionRecovery;
