'use client';

import { useMemo, useState } from 'react';
import type { BeliefAssessment, CravingSession } from '@/domain/types';
import { FREEDOM_LESSONS, localizedLesson } from '@/data/freedomLessons';
import { pickDailyBooster } from '@/domain/freedom/lessonPicker';
import { daysSinceEpoch, startOfLocalDay } from '@/domain/time';
import { useLocalPref } from '@/lib/hooks/useLocalPref';
import { useLocale, useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { SourceBadge } from '@/components/ui/SourceBadge';

const STORAGE_KEY = 'unsmoke.freedom.booster.dismissed';

export type BoosterCardProps = {
  assessments: BeliefAssessment[];
  cravings: CravingSession[];
  now: Date;
};

/**
 * One short read a day, chosen for the promises still sounding convincing and
 * the contexts the user's own cravings happen in (`pickDailyBooster`).
 *
 * Reading a booster persists NOTHING — it is a read, not a logged event, and
 * a `FreedomSession` row per card open would inflate the freedom log with
 * something the user never chose to record. The only state it keeps is the
 * dismissal, and that lives in `localStorage` behind `useLocalPref` (same
 * arrangement as `DiscoveryCard`): a throwaway UI preference, keyed by local
 * day number so tomorrow's booster comes back on its own. `useLocalPref`
 * reports `undefined` until it has really read storage, so a dismissed card
 * never flashes in before hiding itself.
 *
 * The pick is memoised on the local DAY, not on `now` — the page's clock
 * ticks every minute and the booster must not be recomputed under the reader.
 */
export function BoosterCard({ assessments, cravings, now }: BoosterCardProps) {
  const m = useMessages();
  const { locale } = useLocale();
  const { value: dismissedOn, set: setDismissedOn } = useLocalPref(STORAGE_KEY);
  const [expanded, setExpanded] = useState(false);

  // Local midnight, as an exact instant: re-wrapping it in a `Date` inside the
  // memo lands on the same local day `now` is in (reconstructing a day from
  // `daysSinceEpoch` * 86_400_000 would NOT — that number is a UTC-day index of
  // a local midnight, and re-flooring it shifts the day west of UTC).
  const dayStartMs = startOfLocalDay(now).getTime();

  const lesson = useMemo(() => {
    // `pickDailyBooster` throws only if the catalog holds no boosters at all.
    // It always does, but a page-level crash is the wrong failure mode for a
    // supporting card, so this degrades to rendering nothing.
    try {
      return pickDailyBooster(FREEDOM_LESSONS, assessments, cravings, new Date(dayStartMs));
    } catch (err) {
      console.error('Unsmoke: no daily booster available', err);
      return null;
    }
  }, [assessments, cravings, dayStartMs]);

  const today = String(daysSinceEpoch(now));

  if (dismissedOn === undefined || lesson === null || dismissedOn === today) {
    return null;
  }

  const text = localizedLesson(lesson, locale);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-primary-strong">
          {m.freedom.booster.kicker}
        </p>
        <button
          type="button"
          onClick={() => setDismissedOn(today)}
          aria-label={m.freedom.booster.dismiss}
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="text-[15px] font-semibold leading-snug text-ink">{text.title}</p>

      {expanded ? (
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[14px] leading-relaxed text-ink-muted">{text.idea}</p>

          {text.notice ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                {m.freedom.booster.worthNoticing}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{text.notice}</p>
            </div>
          ) : null}

          {text.reflect ? (
            <p className="rounded-card bg-primary-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
              {text.reflect}
            </p>
          ) : null}

          <SourceBadge kind={lesson.sourceKind} className="self-start" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="min-h-11 self-start text-[13px] font-medium text-primary-strong"
      >
        {expanded ? m.freedom.booster.close : m.freedom.booster.readIt}
      </button>
    </Card>
  );
}

export default BoosterCard;
