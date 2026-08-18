/**
 * "You already proved this" — the Freedom feature's evidence engine.
 *
 * Never reimplements: `triggerProof` is a thin wrapper over `alreadyProved`
 * (the existing >= 3 RESOLVED gate for a trigger), and `beliefEncounters`
 * gets its resolved/passed counts from the already-exported `cravingCounts`
 * by pre-filtering to sessions tagged with the belief — so the resolved and
 * passed-without-smoking semantics ("resolved" = outcome !== null &&
 * outcome !== 'unresolved'; preQuit sessions INCLUDED) live in exactly one
 * place: `cravingStats.ts`. No private predicate needed exporting or
 * mirroring for that reason.
 *
 * `proofLine` never fabricates numbers below the gate (the `insights.ts`
 * doctrine): below it, callers get the same neutral fallback line, word for
 * word, regardless of how close the user is to the threshold.
 */

import type { Belief, CravingSession, Locale, Trigger } from '@/domain/types';
import { alreadyProved, cravingCounts } from '@/domain/stats/cravingStats';
import { BELIEF_META } from '@/data/beliefs';
import { triggerInSentence } from '@/data/triggers';

const FALLBACK_TEXT: Record<Locale, string> = {
  en: "We're still learning how this one shows up for you.",
  fi: 'Opettelemme vielä, miten tämä näyttäytyy sinulla.',
};

/** Thin wrapper over `alreadyProved` — the >= 3 RESOLVED gate for a trigger. */
export function triggerProof(
  sessions: CravingSession[],
  trigger: Trigger
): { total: number; passed: number } | null {
  return alreadyProved(sessions, trigger);
}

/**
 * Resolved-only counts for cravings tagged with `beliefId`, matching
 * `cravingCounts`' resolved/passed semantics (preQuit sessions included,
 * unresolved/open sessions excluded from both fields). Delegates entirely to
 * `cravingCounts` on a pre-filtered array rather than re-deriving the
 * resolved/passed predicates.
 */
export function beliefEncounters(
  sessions: CravingSession[],
  beliefId: Belief
): { total: number; passedWithoutSmoking: number } {
  const tagged = sessions.filter((s) => s.beliefId === beliefId);
  const counts = cravingCounts(tagged);
  return { total: counts.resolved, passedWithoutSmoking: counts.passedWithoutSmoking };
}

/**
 * Calm, honest proof line for a belief: grounded only once real evidence
 * clears a >= 3-resolved gate, via EITHER direct belief tags (preferred —
 * `beliefEncounters`) OR, failing that, any of the belief's
 * `relatedTriggers` (in catalog order) clearing `triggerProof`'s own gate.
 * Below both gates, returns the neutral fallback verbatim — never a number
 * the data doesn't support.
 */
export function proofLine(
  sessions: CravingSession[],
  beliefId: Belief,
  locale: Locale = 'en'
): { text: string; grounded: boolean } {
  const encounters = beliefEncounters(sessions, beliefId);
  if (encounters.total >= 3) {
    return {
      grounded: true,
      text:
        locale === 'fi'
          ? `Olet ollut tässä ${encounters.total} kertaa. ${encounters.passedWithoutSmoking} meni ohi ilman tupakkaa.`
          : `You've been here ${encounters.total} times. ${encounters.passedWithoutSmoking} passed without smoking.`,
    };
  }

  for (const trigger of BELIEF_META[beliefId].relatedTriggers) {
    const proof = triggerProof(sessions, trigger);
    if (proof === null) continue;
    const fragment = triggerInSentence(trigger, locale);
    return {
      grounded: true,
      text:
        locale === 'fi'
          ? `Olet ollut ${fragment} ${proof.total} kertaa. ${proof.passed} meni ohi ilman tupakkaa.`
          : `You've been in ${fragment} moments like this ${proof.total} times. ${proof.passed} passed without smoking.`,
    };
  }

  return { grounded: false, text: FALLBACK_TEXT[locale] };
}
