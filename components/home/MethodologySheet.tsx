'use client';

import type { ReactNode } from 'react';
import type { QuitProfile } from '@/domain/types';
import { Sheet } from '@/components/ui/Sheet';
import {
  MINUTES_OF_LIFE_PER_CIGARETTE,
  cigarettesAvoided,
  moneySaved,
} from '@/domain/stats/quitStats';
import { formatCount } from '@/components/formatCount';
import { formatMoney } from './formatMoney';

export type MethodologySheetProps = {
  open: boolean;
  onClose: () => void;
  profile: QuitProfile;
  now: Date;
};

function Row({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[15px] font-semibold text-ink">{heading}</h3>
      <p className="text-[14px] leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

/**
 * Where the three numbers on the Today screen come from — in the user's own
 * figures, with the uncertainty left in rather than rounded away. Opened by
 * tapping any stat tile.
 */
export function MethodologySheet({ open, onClose, profile, now }: MethodologySheetProps) {
  const avoided = cigarettesAvoided(profile, now);
  const saved = moneySaved(profile, now);

  return (
    <Sheet open={open} onClose={onClose} title="How these numbers work">
      <div className="flex flex-col gap-5 pb-2">
        <Row heading="Cigarettes not smoked">
          You told us you smoked {profile.cigarettesPerDay} a day. We multiply that by
          how long you&rsquo;ve been smoke-free and round down — so far, {formatCount(avoided)}.
        </Row>

        <Row heading="Money saved">
          {profile.cigarettesPerDay} cigarettes a day out of packs of{' '}
          {profile.cigarettesPerPack} at {formatMoney(profile.packPrice, profile.currency)}{' '}
          a pack works out at {formatMoney(saved, profile.currency)} so far. It assumes
          your old rate stayed constant and that prices haven&rsquo;t changed.
        </Row>

        <Row heading="Life regained">
          Research from UCL (2024) estimates each cigarette costs roughly 17–22 minutes of
          life. We use {MINUTES_OF_LIFE_PER_CIGARETTE} minutes, near the middle of that
          range, multiplied by the cigarettes you haven&rsquo;t smoked. It&rsquo;s a
          population average, not a promise about your particular body.
        </Row>

        <p className="rounded-card bg-surface-raised px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          These are estimates, honestly labeled.
        </p>
      </div>
    </Sheet>
  );
}

export default MethodologySheet;
