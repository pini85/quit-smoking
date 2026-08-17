'use client';

import { useState } from 'react';
import type { CravingSession, QuitProfile, Trigger } from '@/domain/types';
import { smokeFreeDuration, moneySaved } from '@/domain/stats/quitStats';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { formatMoney } from '@/components/home/formatMoney';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
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
  // Latched at mount so a mis-tapped chip can be tapped again to clear it.
  const [askTrigger] = useState(() => trigger === undefined);
  const quitAt = new Date(profile.quitAt);
  const days = smokeFreeDuration(quitAt, now).days;
  const saved = formatMoney(moneySaved(profile, now), profile.currency);
  const beaten = cravingCounts(cravings).passedWithoutSmoking;

  return (
    <div className="animate-fade-in flex min-h-[80dvh] flex-col gap-6">
      <div className="pt-6">
        <h1 className="text-[26px] font-semibold leading-tight text-ink">
          Okay. Thanks for being honest &mdash; that matters more than the cigarette.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
          One cigarette is a data point, not a verdict. Your body&rsquo;s recovery
          doesn&rsquo;t reset to zero, and neither does this app.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-[13px] font-medium text-ink-muted">Still yours:</p>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="days smoke-free" value={days} />
          <StatTile label="saved" value={saved} />
          <StatTile label="cravings beaten" value={beaten} />
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-5">
        {askTrigger ? (
          <TriggerChips
            label="What triggered it? — optional"
            value={trigger}
            onChange={onTriggerChange}
          />
        ) : null}
        <Button size="lg" fullWidth onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

export default SlipScreen;
