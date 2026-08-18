'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AchievementCondition,
  AchievementDefinition,
  AchievementUnlock,
  CravingSession,
  QuitProfile,
} from '@/domain/types';
import { ACHIEVEMENT_DEFINITIONS, localizedAchievement } from '@/domain/achievements/definitions';
import { progressToward, type AchievementContext } from '@/domain/achievements/engine';
import { triggerLabel } from '@/data/triggers';
import { sweepAchievements } from '@/lib/services/achievementSweep';
import { interpolate, useLocale, useMessages, type Messages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
import type { Locale } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { ProgressBar } from '@/components/ui/ProgressBar';

export type AchievementsGridProps = {
  profile: QuitProfile;
  cravings: CravingSession[];
  unlocks: AchievementUnlock[];
  store: DataStore;
  now: Date;
};


/**
 * Plain-language description of a LOCKED achievement's target — never a
 * progress string (that's `ProgressBar` + `progressToward`), always the
 * fixed condition text. Takes only the condition, deliberately: this is
 * fact-of-the-badge copy, not something that depends on the user's data.
 */
export function criteriaText(
  cond: AchievementCondition,
  m: Messages['you']['achievements'],
  locale: Locale = 'en'
): string {
  switch (cond.type) {
    case 'smoke-free-hours':
      return interpolate(m.criteria.smokeFreeHours, { hours: cond.hours });
    case 'cigarettes-avoided':
      return interpolate(m.criteria.cigarettesAvoided, { count: cond.count });
    case 'money-saved':
      return interpolate(m.criteria.moneySaved, { amount: cond.amount });
    case 'cravings-passed':
      return interpolate(m.criteria.cravingsPassed, { count: cond.count });
    case 'trigger-passed':
      return interpolate(m.criteria.triggerPassed, {
        count: cond.count,
        trigger: triggerLabel(cond.trigger, locale).toLowerCase(),
      });
    case 'craving-free-hours':
      return interpolate(m.criteria.cravingFreeHours, { hours: cond.hours });
    case 'smoke-free-weekend':
      return m.criteria.smokeFreeWeekend;
  }
}

function AchievementTile({
  def,
  unlockedAt,
  ctx,
  onOpen,
}: {
  def: AchievementDefinition;
  unlockedAt: string | null;
  ctx: AchievementContext;
  onOpen: () => void;
}) {
  const { locale } = useLocale();
  const m = useMessages();
  if (unlockedAt !== null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[104px] flex-col justify-between gap-2 rounded-card border border-primary bg-primary-soft p-3 text-left transition-transform duration-[var(--dur-press)] active:scale-[0.97]"
      >
        <span className="text-[13px] font-semibold leading-snug text-primary-strong">
          {localizedAchievement(def, locale).title}
        </span>
        <span className="text-[11px] text-ink-faint">
          {dateFmt(locale, { dateStyle: 'short' }).format(new Date(unlockedAt))}
        </span>
      </button>
    );
  }

  // Progress is clamped to [0, 1] for display — `progressToward`'s `current`
  // can exceed `target` for count-based conditions (e.g. a user who logged
  // 30 passed cravings before the "25 beaten" definition existed), and a
  // bar rendered past 100% would look broken rather than impressive.
  const { current, target } = progressToward(def, ctx);
  const pct = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;

  return (
    <div className="flex min-h-[104px] flex-col justify-between gap-2 rounded-card border border-border bg-surface p-3 text-left">
      <span className="text-[13px] font-semibold leading-snug text-ink-muted">
        {localizedAchievement(def, locale).title}
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] leading-snug text-ink-muted">
          {criteriaText(def.condition, m.you.achievements, locale)}
        </span>
        <ProgressBar value={pct} className="h-1" />
      </div>
    </div>
  );
}

/**
 * All 30 achievement definitions as a 3-col grid. Unlocked tiles are filled
 * and tappable (a `Sheet` reveals the fact + unlock date); locked tiles
 * stay outlined with plain criteria text and a progress bar — never a
 * mystery box, per the brief.
 *
 * Also runs a mount-time unlock sweep: the You screen is somewhere a user
 * can land long after the achievement conditions became true (e.g. a
 * smoke-free-hours badge nobody happened to trigger a craving-flow sweep
 * for), so this is the catch-all that keeps the grid honest.
 */
export function AchievementsGrid({ profile, cravings, unlocks, store, now }: AchievementsGridProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    sweepAchievements(store).catch((error: unknown) => {
      console.error('Unsmoke: failed to sweep achievements', error);
    });
  }, [store]);

  const unlockedMap = useMemo(
    () => new Map(unlocks.map((u) => [u.id, u.unlockedAt])),
    [unlocks]
  );

  const ctx = useMemo<AchievementContext>(
    () => ({ profile, cravings, unlocked: new Set(unlockedMap.keys()), now }),
    [profile, cravings, unlockedMap, now]
  );

  const openDef = openId ? ACHIEVEMENT_DEFINITIONS.find((d) => d.id === openId) ?? null : null;
  const openUnlockedAt = openId ? unlockedMap.get(openId) ?? null : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{m.you.achievements.title}</h2>
        <span className="text-[13px] tabular-nums text-ink-muted">
          {unlockedMap.size}/{ACHIEVEMENT_DEFINITIONS.length}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ACHIEVEMENT_DEFINITIONS.map((def) => (
          <AchievementTile
            key={def.id}
            def={def}
            unlockedAt={unlockedMap.get(def.id) ?? null}
            ctx={ctx}
            onOpen={() => setOpenId(def.id)}
          />
        ))}
      </div>

      <Sheet
        open={openDef !== null}
        onClose={() => setOpenId(null)}
        title={openDef ? localizedAchievement(openDef, locale).title : undefined}
      >
        {openDef && openUnlockedAt ? (
          <div className="flex flex-col gap-3 pb-2">
            <p className="text-[15px] leading-relaxed text-ink-muted">
              {localizedAchievement(openDef, locale).fact}
            </p>
            <p className="text-[13px] text-ink-faint">
              {interpolate(m.you.achievements.unlockedOn, {
                date: dateFmt(locale, { dateStyle: 'medium' }).format(new Date(openUnlockedAt)),
              })}
            </p>
          </div>
        ) : null}
      </Sheet>
    </Card>
  );
}

export default AchievementsGrid;
