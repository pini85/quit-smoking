'use client';

import { useState } from 'react';
import type { MoneyEquivalent, QuitProfile } from '@/domain/types';
import {
  cigarettesAvoided,
  lifeRegained,
  moneyEquivalentsFor,
  moneySaved,
} from '@/domain/stats/quitStats';
import { StatTile } from '@/components/ui/StatTile';
import { Card } from '@/components/ui/Card';
import { formatCount } from '@/components/formatCount';
import { useLocale, useMessages } from '@/lib/i18n';
import { MethodologySheet } from './MethodologySheet';
import { formatMoney } from './formatMoney';

export type StatsRowProps = {
  profile: QuitProfile;
  now: Date;
  moneyEquivalents?: MoneyEquivalent[];
};

/**
 * Three numbers, one tap away from an explanation of exactly how each was
 * reached. The tiles are buttons rather than static text precisely because
 * the honesty note is the point — nothing here is a number without a story.
 */
export function StatsRow({ profile, now, moneyEquivalents }: StatsRowProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const m = useMessages();

  const avoided = cigarettesAvoided(profile, now);
  const saved = moneySaved(profile, now);
  const life = lifeRegained(avoided);
  const equivalent = moneyEquivalentsFor(saved, moneyEquivalents)[0];

  return (
    <>
      <Card className="grid grid-cols-3 gap-2">
        <StatTile
          value={formatCount(avoided, locale)}
          label={m.home.stats.notSmoked}
          onPress={() => setOpen(true)}
        />
        <StatTile
          value={formatMoney(saved, profile.currency, locale)}
          label={m.home.stats.saved}
          sub={equivalent ? `≈ ${equivalent.count}× ${equivalent.label}` : undefined}
          onPress={() => setOpen(true)}
        />
        <StatTile
          // Grouped day count (a decade-long quit regains 1,000+ days), so
          // the compact unit is appended by hand rather than via formatCompact.
          value={
            locale === 'fi'
              ? `${formatCount(life.days, 'fi')} pv ${life.hours} t`
              : `${formatCount(life.days)}d ${life.hours}h`
          }
          label={m.home.stats.lifeRegained}
          onPress={() => setOpen(true)}
        />
      </Card>

      <MethodologySheet
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        now={now}
      />
    </>
  );
}

export default StatsRow;
