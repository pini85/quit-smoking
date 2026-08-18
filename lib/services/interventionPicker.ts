/**
 * Chooses which two interrupters to put in front of someone who is mid-craving.
 *
 * Pure and synchronous — no clock, no storage, no React — so the single most
 * important decision the app makes ("what do we show first") is unit-testable
 * in isolation. `components/craving/InterrupterStep.tsx` is the only caller.
 *
 * The ordering of the rules is the product: help comes first, evidence second.
 */

import type { CravingSession, Trigger } from '@/domain/types';
import type { InterventionKind } from '@/data/interventions';
import { alreadyProved } from '@/domain/stats/cravingStats';

/**
 * The rotation pool, in the order used to break "never used before" ties.
 * `reasons` joins the end of it only when the user actually wrote reasons;
 * `proof` is never in it (it can only ever be the alternative, see below).
 */
export const INTERVENTION_POOL: InterventionKind[] = [
  'urge-surf',
  'delay',
  'scene-change',
  'water',
  'breathing',
];

const HIGH_INTENSITY = 7;

export interface PickInterventionsInput {
  /** 1-10, the intensity the user just tapped. */
  intensity: number;
  trigger?: Trigger;
  /** Session history, EXCLUDING the session in progress. */
  sessions: CravingSession[];
  /** How many (unarchived) personal reasons the user has written. */
  reasonsCount: number;
  /** Last-used order, MOST RECENT FIRST. Ids not in this list were never used. */
  recentInterventionIds: string[];
}

export interface PickedInterventions {
  primary: InterventionKind;
  alternative: InterventionKind;
}

/**
 * How stale a kind is: its index in the most-recent-first recency list, or
 * `recent.length` (i.e. staler than anything ever used) when it is absent.
 * Bigger = less recently used. A sentinel rather than `Infinity` keeps the
 * comparator's subtraction finite, so ties among never-used kinds resolve
 * to `INTERVENTION_POOL` order via the sort's stability.
 */
function staleness(kind: InterventionKind, recent: string[]): number {
  const index = recent.indexOf(kind);
  return index === -1 ? recent.length : index;
}

function leastRecentlyUsed(pool: InterventionKind[], recent: string[]): InterventionKind[] {
  return [...pool].sort((a, b) => staleness(b, recent) - staleness(a, recent));
}

export function pickInterventions(input: PickInterventionsInput): PickedInterventions {
  const { intensity, trigger, sessions, reasonsCount, recentInterventionIds } = input;

  // Rule 1 — the proof gate. `alreadyProved` needs >= 3 RESOLVED sessions with
  // this trigger. When it fires, 'proof' takes the ALTERNATIVE slot and never
  // the primary one: someone at intensity 9 needs something to *do*, and
  // being shown their own statistics instead would be a worse first move.
  const proved = trigger !== undefined && alreadyProved(sessions, trigger) !== null;

  // 'reasons' is only ever offered when there is something to show.
  const pool: InterventionKind[] =
    reasonsCount > 0 ? [...INTERVENTION_POOL, 'reasons'] : [...INTERVENTION_POOL];

  const ranked = leastRecentlyUsed(pool, recentInterventionIds);

  // Rules 2 & 3 — the primary.
  let primary: InterventionKind;
  if (intensity >= HIGH_INTENSITY) {
    // A strong craving gets the physiological lever (long exhale) unless the
    // user just did exactly that — repeating it immediately reads as the app
    // not listening, so we hand them the other high-intensity tool.
    primary = recentInterventionIds[0] === 'breathing' ? 'urge-surf' : 'breathing';
  } else {
    primary = ranked[0];
  }

  // Rule 4 — the alternative.
  const alternative = proved
    ? 'proof'
    : (ranked.find((kind) => kind !== primary) as InterventionKind);

  return { primary, alternative };
}

export default pickInterventions;
