'use client';

import { useState } from 'react';
import type { CravingSession, QuitProfile, Trigger } from '@/domain/types';
import { smokeFreeDuration, moneySaved } from '@/domain/stats/quitStats';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { formatMoney } from '@/components/home/formatMoney';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { useLocale, useMessages } from '@/lib/i18n';
import { TriggerChips } from './TriggerChips';

export type SlipScreenProps = {
  profile: QuitProfile;
  /** Full list, INCLUDING the just-recorded slip. */
  cravings: CravingSession[];
  now: Date;
  trigger?: Trigger;
  onTriggerChange: (trigger: Trigger | undefined) => void;
  onDone: () => void;
};

/**
 * What the user sees after telling the truth.
 *
 * There is no red on this screen, no streak reset, no "try again tomorrow"
 * and nothing that reads as a verdict — the muted primary palette is the
 * same one the rest of the flow uses. The three tiles exist to make one
 * specific, checkable point: the numbers did not go to zero. An app that
 * punishes an honest slip just teaches people to stop logging them, and a
 * user who stops logging is a user we can no longer help.
 */
export function SlipScreen({
  profile,
  cravings,
  now,
  trigger,
  onTriggerChange,
  onDone,
}: SlipScreenProps) {
  const { locale } = useLocale();
  const m = useMessages();
  // Latched at mount so a mis-tapped chip can be tapped again to clear it.
  const [askTrigger] = useState(() => trigger === undefined);
  const quitAt = new Date(profile.quitAt);
  const days = smokeFreeDuration(quitAt, now).days;
  const saved = formatMoney(moneySaved(profile, now), profile.currency, locale);
  const beaten = cravingCounts(cravings).passedWithoutSmoking;

  return (
    <div className="animate-fade-in flex min-h-[80dvh] flex-col gap-6">
      <div className="pt-6">
        <h1 className="text-[26px] font-semibold leading-tight text-ink">
          {m.craving.slip.headline}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">{m.craving.slip.body}</p>
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-[13px] font-medium text-ink-muted">{m.craving.slip.stillYours}</p>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label={m.craving.slip.daysSmokeFree} value={days} />
          <StatTile label={m.craving.slip.saved} value={saved} />
          <StatTile label={m.craving.slip.cravingsBeaten} value={beaten} />
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-5">
        {askTrigger ? (
          <TriggerChips
            label={m.craving.slip.triggerLabel}
            value={trigger}
            onChange={onTriggerChange}
          />
        ) : null}
        <Button size="lg" fullWidth onClick={onDone}>
          {m.craving.slip.done}
        </Button>
      </div>
    </div>
  );
}

export default SlipScreen;
