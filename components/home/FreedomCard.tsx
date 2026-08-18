'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { BeliefAssessment, CravingSession } from '@/domain/types';
import { FREEDOM_LESSONS, localizedLesson } from '@/data/freedomLessons';
import { pickDailyBooster } from '@/domain/freedom/lessonPicker';
import { startOfLocalDay } from '@/domain/time';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';

export type FreedomCardProps = {
  assessments: BeliefAssessment[];
  cravings: CravingSession[];
  now: Date;
};

/**
 * The way into the belief work from Today: one door for the argument happening
 * right now ("my brain is convincing me…" → the brain flow), and one quiet
 * line pointing at today's booster on Freedom.
 *
 * Shown in PRE-QUIT mode too, unlike the stats and the body carousel. The
 * promises smoking makes are at their loudest while the user is still smoking,
 * and taking them apart before the quit moment is the most useful thing this
 * screen can offer someone who has not stopped yet — so this card never gates
 * on `preQuit`.
 *
 * The teaser deliberately IGNORES the booster's dismissal preference (the one
 * `BoosterCard` keeps): this is a link to a screen, not the booster itself, so
 * dismissing today's read on Freedom shouldn't blank a navigation affordance
 * here. Reading the title persists nothing either way.
 *
 * The primary action is a `<Link>` styled like a secondary `Button` rather
 * than a `<Button>` inside a `<Link>` — a `<button>` nested in an `<a>` is
 * invalid HTML and swallows the anchor's keyboard behaviour. Secondary
 * (primary-soft) on purpose: clearly tappable, but visibly not competing with
 * the craving FAB, which stays the loudest thing on the screen.
 */
export function FreedomCard({ assessments, cravings, now }: FreedomCardProps) {
  const m = useMessages();
  const { locale } = useLocale();
  // Memoised on the local DAY, not on `now`: Today ticks once a minute and the
  // teaser must not shuffle under the reader. Same reasoning (and the same
  // local-midnight instant) as `BoosterCard`.
  const dayStartMs = startOfLocalDay(now).getTime();

  const lesson = useMemo(() => {
    // Throws only if the catalog holds no boosters at all — it always does,
    // but the teaser is supporting copy, so this degrades to no teaser rather
    // than taking Today down with it.
    try {
      return pickDailyBooster(FREEDOM_LESSONS, assessments, cravings, new Date(dayStartMs));
    } catch (err) {
      console.error('Unsmoke: no daily booster available', err);
      return null;
    }
  }, [assessments, cravings, dayStartMs]);

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-primary-strong">
        {m.home.freedomCard.kicker}
      </p>

      <Link
        href="/brain"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary-soft px-5 text-[15px] font-medium text-primary-strong transition-transform duration-[var(--dur-press)] active:scale-[0.97]"
      >
        {m.home.freedomCard.brainLink}
      </Link>

      {lesson ? (
        <Link
          href="/freedom"
          className="flex min-h-11 items-center text-[13px] leading-relaxed text-ink-muted"
        >
          {/* `min-w-0` is what actually lets `truncate` bite: a flex item
              won't shrink below its content width without it. */}
          <span className="min-w-0 truncate">
            {interpolate(m.home.freedomCard.booster, {
              title: localizedLesson(lesson, locale).title,
            })}
          </span>
          <span aria-hidden="true" className="ml-1 shrink-0 text-primary-strong">
            &rarr;
          </span>
        </Link>
      ) : null}
    </Card>
  );
}

export default FreedomCard;
