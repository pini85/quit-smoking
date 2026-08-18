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
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
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
  const { locale } = useLocale();
  const m = useMessages();
  const avoided = cigarettesAvoided(profile, now);
  const saved = moneySaved(profile, now);

  return (
    <Sheet open={open} onClose={onClose} title={m.home.methodology.title}>
      <div className="flex flex-col gap-5 pb-2">
        <Row heading={m.home.methodology.cigsHeading}>
          {interpolate(m.home.methodology.cigsBody, {
            perDay: profile.cigarettesPerDay,
            count: formatCount(avoided, locale),
          })}
        </Row>

        <Row heading={m.home.methodology.moneyHeading}>
          {interpolate(m.home.methodology.moneyBody, {
            perDay: profile.cigarettesPerDay,
            perPack: profile.cigarettesPerPack,
            packPrice: formatMoney(profile.packPrice, profile.currency, locale),
            saved: formatMoney(saved, profile.currency, locale),
          })}
        </Row>

        <Row heading={m.home.methodology.lifeHeading}>
          {interpolate(m.home.methodology.lifeBody, {
            minutes: MINUTES_OF_LIFE_PER_CIGARETTE,
          })}
        </Row>

        <p className="rounded-card bg-surface-raised px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          {m.home.methodology.estimatesNote}
        </p>
      </div>
    </Sheet>
  );
}

export default MethodologySheet;
