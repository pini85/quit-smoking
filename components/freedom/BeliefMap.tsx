'use client';

import { useMemo } from 'react';
import type { Belief, BeliefAssessment } from '@/domain/types';
import { beliefPromise } from '@/data/beliefs';
import { beliefGroups, beliefTrend, type BeliefGroupKey } from '@/domain/freedom/beliefState';
import { Card } from '@/components/ui/Card';
import { useLocale, useMessages, type Messages } from '@/lib/i18n';

export type BeliefMapProps = {
  assessments: BeliefAssessment[];
  onOpenBelief: (belief: Belief) => void;
};

/**
 * The belief map: eighteen promises smoking makes, filed by where each promise
 * currently stands. Tapping one opens its exercise.
 *
 * Anti-diagnosis rules, all binding and all visible in this file:
 *
 * - Every heading describes the PROMISE ("Still sounds convincing"), never the
 *   person holding it. Nothing here is a verdict about the reader.
 * - No numerals anywhere: no scores, no percentages, no "3 of 18 seen
 *   through", no section counts. A number would turn a map into a scoreboard,
 *   and a scoreboard invites the reader to grade themselves.
 * - `BeliefAssessment.strength` is never rendered in any form. The most the
 *   map will say about movement is a single trend line, and only in the
 *   direction that helps: "Felt weaker than last time" for 'weakening', and
 *   deliberately nothing at all for 'holding' — a promise that held its ground
 *   is not news the reader needs pushed at them.
 * - A promise that comes back stronger re-files itself into "Still sounds
 *   convincing" silently (that is `beliefGroups`' own behaviour — no ratchet),
 *   with no "moved back" language and no before/after.
 * - "Seen through" is tinted with `primary-soft`, never `accent`: amber is the
 *   celebration colour, and seeing through a promise is a quiet noticing.
 */
const SECTIONS: { key: BeliefGroupKey; headingKey: keyof Messages['freedom']['map']['sections'] }[] = [
  { key: 'working-through', headingKey: 'workingThrough' },
  { key: 'seen-through', headingKey: 'seenThrough' },
  { key: 'unexplored', headingKey: 'unexplored' },
];

export function BeliefMap({ assessments, onOpenBelief }: BeliefMapProps) {
  const m = useMessages();
  const { locale } = useLocale();
  const groups = useMemo(() => beliefGroups(assessments), [assessments]);
  const trends = useMemo(() => {
    const byBelief = new Map<Belief, boolean>();
    for (const belief of Object.values(groups).flat()) {
      byBelief.set(belief, beliefTrend(assessments, belief) === 'weakening');
    }
    return byBelief;
  }, [assessments, groups]);

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          {m.freedom.map.heading}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {m.freedom.map.subheading}
        </p>
      </div>

      {SECTIONS.map(({ key, headingKey }) => {
        const beliefs = groups[key];
        if (beliefs.length === 0) return null;

        const seenThrough = key === 'seen-through';

        return (
          <section key={key} className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              {m.freedom.map.sections[headingKey]}
            </h3>

            <ul className="flex flex-col gap-2">
              {beliefs.map((belief) => (
                <li key={belief}>
                  <button
                    type="button"
                    onClick={() => onOpenBelief(belief)}
                    className={[
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-card px-4 py-3 text-left',
                      'transition-transform duration-[var(--dur-press)] active:scale-[0.99]',
                      seenThrough
                        ? 'bg-primary-soft'
                        : 'border border-border bg-surface-raised',
                    ].join(' ')}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={`text-[14px] leading-snug ${seenThrough ? 'text-primary-strong' : 'text-ink'}`}
                      >
                        &ldquo;{beliefPromise(belief, locale)}&rdquo;
                      </span>
                      {trends.get(belief) === true ? (
                        <span className="text-[12px] leading-snug text-ink-faint">
                          {m.freedom.map.weakerThanLastTime}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-[13px] ${seenThrough ? 'text-primary-strong' : 'text-ink-faint'}`}
                    >
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Card>
  );
}

export default BeliefMap;
