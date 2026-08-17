/**
 * Construction and field-level edits for a craving session row.
 *
 * Pure and explicit-clock, so the two things that are easy to get quietly
 * wrong — the `preQuit` flag, and never writing `trigger: undefined` into a
 * row that is round-tripped through export/import — are pinned by tests
 * rather than by care.
 */

import type { CravingSession, Trigger } from '@/domain/types';
import { toLocalIso } from '@/lib/utils/iso';

export interface BuildCravingSessionInput {
  id: string;
  startedAt: Date;
  initialIntensity: number;
  trigger?: Trigger;
  /** The profile's quit moment, or null when there is somehow no profile. */
  quitAt: Date | null;
}

/**
 * The row written the instant the user taps an intensity. `outcome` is null —
 * the session is open, and stays open until step 3 or the finalizer closes it.
 */
export function buildCravingSession(input: BuildCravingSessionInput): CravingSession {
  const { id, startedAt, initialIntensity, trigger, quitAt } = input;
  return {
    id,
    startedAt: toLocalIso(startedAt),
    initialIntensity,
    outcome: null,
    preQuit: quitAt !== null && quitAt.getTime() > startedAt.getTime(),
    // Spread rather than `trigger` — an explicit `trigger: undefined` key
    // survives structured clone into IndexedDB and then serialises as a null
    // in an export, which the import schema is right to reject.
    ...(trigger === undefined ? {} : { trigger }),
  };
}

/** Sets or CLEARS the trigger, removing the key entirely when cleared. */
export function withTrigger(
  session: CravingSession,
  trigger: Trigger | undefined
): CravingSession {
  const next = { ...session };
  if (trigger === undefined) {
    delete next.trigger;
  } else {
    next.trigger = trigger;
  }
  return next;
}
