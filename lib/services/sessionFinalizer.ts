/**
 * The abandonment safety net for craving sessions.
 *
 * A session row is written the moment the user taps an intensity — before we
 * know how it ended. If they then put the phone down (which is often exactly
 * what we asked them to do), that row would sit open forever and quietly
 * poison every statistic. This module decides, for a set of open sessions,
 * which one is still worth asking about and which ones should just be closed.
 *
 * Pure: explicit `now`, no clock access, never mutates its input.
 * `components/craving/SessionRecovery.tsx` is the only caller.
 */

import type { CravingSession } from '@/domain/types';
import { toLocalIso } from '@/lib/utils/iso';

/**
 * How long an open session stays "askable". Fifteen minutes is past the tail
 * of a typical craving, so anything older is a session the user walked away
 * from rather than one they are still in.
 */
export const ABANDON_AFTER_MS = 15 * 60_000;

export interface OpenSessionClassification {
  /** The one session worth asking "how did it go?" about — or null. */
  resume: CravingSession | null;
  /** Sessions to close as 'unresolved' right now. */
  finalize: CravingSession[];
}

/**
 * Splits open sessions into "ask about this one" and "close these".
 *
 * - Anything >= {@link ABANDON_AFTER_MS} old is closed (boundary inclusive).
 * - Of what remains, only the single most recent is resumable — asking about
 *   two overlapping cravings at once is noise, so the older fresh ones are
 *   closed too.
 * - Rows that already carry an outcome are ignored entirely (defensive: they
 *   are not "open" and must be neither resumed nor re-finalized).
 */
export function classifyOpenSessions(
  open: CravingSession[],
  now: Date
): OpenSessionClassification {
  const nowMs = now.getTime();
  const fresh: CravingSession[] = [];
  const finalize: CravingSession[] = [];

  for (const session of open) {
    if (session.outcome !== null) continue;
    const ageMs = nowMs - new Date(session.startedAt).getTime();
    // A negative age (device clock moved backwards) counts as fresh — better
    // to ask a redundant question than to silently discard a live session.
    if (ageMs >= ABANDON_AFTER_MS) {
      finalize.push(session);
    } else {
      fresh.push(session);
    }
  }

  let resume: CravingSession | null = null;
  for (const session of fresh) {
    if (
      resume === null ||
      new Date(session.startedAt).getTime() > new Date(resume.startedAt).getTime()
    ) {
      resume = session;
    }
  }

  for (const session of fresh) {
    if (session !== resume) finalize.push(session);
  }

  return { resume, finalize };
}

/**
 * The closed form of an abandoned session. `endedAt` is pinned to
 * `startedAt + 15min` rather than to "now" so the row does not claim a
 * multi-hour craving just because the app was reopened the next morning.
 * `finalIntensity` stays absent — nobody re-measured it — and 'unresolved' is
 * excluded from both sides of the pass rate, so this never flatters or
 * punishes the user's numbers.
 */
export function finalizeAbandoned(session: CravingSession): CravingSession {
  return {
    ...session,
    outcome: 'unresolved',
    endedAt: toLocalIso(new Date(new Date(session.startedAt).getTime() + ABANDON_AFTER_MS)),
  };
}
