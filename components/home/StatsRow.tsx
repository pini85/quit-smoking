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

  const avoided = cigarettesAvoided(profile, now);
  const saved = moneySaved(profile, now);
  const life = lifeRegained(avoided);
  const equivalent = moneyEquivalentsFor(saved, moneyEquivalents)[0];

  return (
    <>
      <Card className="grid grid-cols-3 gap-2">
        <StatTile
          value={avoided}
          label="not smoked"
          onPress={() => setOpen(true)}
        />
        <StatTile
          value={formatMoney(saved, profile.currency)}
          label="saved"
          sub={equivalent ? `≈ ${equivalent.count}× ${equivalent.label}` : undefined}
          onPress={() => setOpen(true)}
        />
        <StatTile
          value={`${life.days}d ${life.hours}h`}
          label="life regained"
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
