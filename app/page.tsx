'use client';

import { useMemo, useState } from 'react';
import type { HealthMilestone } from '@/domain/types';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { computeMilestoneStates } from '@/domain/milestones/engine';
import { currentStreakStart } from '@/domain/stats/quitStats';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { Card } from '@/components/ui/Card';
import { MilestoneSheet } from '@/components/health/MilestoneSheet';
import { Hero } from '@/components/home/Hero';
import { StatsRow } from '@/components/home/StatsRow';
import { BodyNowCarousel, PreQuitPrepCard } from '@/components/home/BodyNowCarousel';
import { WinsStrip } from '@/components/home/WinsStrip';
import { DiscoveryCard } from '@/components/home/DiscoveryCard';
import { SlipCheckinCard } from '@/components/home/SlipCheckinCard';

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

/**
 * Today — the screen that has to make quitting feel alive.
 *
 * The clock is split deliberately: this page ticks once a minute, and only
 * `<Hero>` subscribes to the one-second clock, so the per-second re-render
 * never reaches the stats, the carousel or the cards below.
 */
export default function TodayPage() {
  const { data } = useAppData();
  const now = useNow(60000);
  const [sheetMilestone, setSheetMilestone] = useState<HealthMilestone | null>(null);

  const profile = data.profile;
  const quitAtMs = profile ? new Date(profile.quitAt).getTime() : null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  // Recomputed once a minute (not once a render) — 80 milestone states is
  // cheap but not free, and every section below reads the same list.
  const states = useMemo(() => {
    if (quitAtMs === null) return [];
    return computeMilestoneStates(
      HEALTH_MILESTONES,
      new Date(quitAtMs),
      new Date(minuteKey * 60_000)
    );
  }, [quitAtMs, minuteKey]);

  // The current streak's anchor: quitAt until something is smoked, the last
  // slip after that. Only the hero's headline duration uses it — every other
  // number on this screen is a lifetime-since-quit total.
  const streakStart = useMemo(() => {
    if (quitAtMs === null) return null;
    return currentStreakStart(new Date(quitAtMs), data.cravings);
  }, [quitAtMs, data.cravings]);

  if (data.status !== 'ready' || profile === null || quitAtMs === null) {
    return <Skeleton />;
  }

  const quitAt = new Date(quitAtMs);
  const preQuit = quitAtMs > now.getTime();
  const showEmergingEvidence = data.preferences?.showEmergingEvidence ?? true;

  return (
    <>
      <div className="flex flex-col gap-4 pt-2">
        <Hero
          quitAt={quitAt}
          streakStart={streakStart ?? quitAt}
          onOpenMilestone={setSheetMilestone}
        />

        {preQuit ? null : (
          <StatsRow
            profile={profile}
            now={now}
            moneyEquivalents={data.preferences?.moneyEquivalents}
          />
        )}

        {preQuit ? (
          <PreQuitPrepCard />
        ) : (
          <BodyNowCarousel
            states={states}
            showEmergingEvidence={showEmergingEvidence}
            onOpenMilestone={setSheetMilestone}
          />
        )}

        <WinsStrip cravings={data.cravings} />

        <DiscoveryCard now={now} onOpenMilestone={setSheetMilestone} />

        <SlipCheckinCard cravings={data.cravings} now={now} />
      </div>

      <MilestoneSheet
        milestone={sheetMilestone}
        onClose={() => setSheetMilestone(null)}
        quitAt={quitAt}
        now={now}
      />
    </>
  );
}
