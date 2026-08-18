'use client';

import { useMemo, useState } from 'react';
import type { HealthMilestone } from '@/domain/types';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { computeMilestoneStates } from '@/domain/milestones/engine';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { Card } from '@/components/ui/Card';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { MilestoneSheet } from '@/components/health/MilestoneSheet';
import { RightNowView } from '@/components/health/RightNowView';
import { TimelineView } from '@/components/health/TimelineView';
import { BodyExplorerView } from '@/components/health/BodyExplorerView';
import { useMessages } from '@/lib/i18n';

type Segment = 'right-now' | 'timeline' | 'body';

function isSegment(id: string): id is Segment {
  return id === 'right-now' || id === 'timeline' || id === 'body';
}

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
 * "Your recovery" — the three ways of looking at the same milestone data:
 * what's happening right now, the full timeline of it, and a browsable map
 * of the body. All three read from one `states` computation so they can
 * never disagree with each other about what's achieved.
 */
export default function HealthPage() {
  const { data } = useAppData();
  const now = useNow(60000);
  const m = useMessages();
  const SEGMENTS: SegmentedOption[] = [
    { id: 'right-now', label: m.health.segments.rightNow },
    { id: 'timeline', label: m.health.segments.timeline },
    { id: 'body', label: m.health.segments.body },
  ];
  const [segment, setSegment] = useState<Segment>('right-now');
  const [sheetMilestone, setSheetMilestone] = useState<HealthMilestone | null>(null);

  const profile = data.profile;
  const quitAtMs = profile ? new Date(profile.quitAt).getTime() : null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const states = useMemo(() => {
    if (quitAtMs === null) return [];
    return computeMilestoneStates(
      HEALTH_MILESTONES,
      new Date(quitAtMs),
      new Date(minuteKey * 60_000)
    );
  }, [quitAtMs, minuteKey]);

  if (data.status !== 'ready' || profile === null || quitAtMs === null) {
    return <Skeleton />;
  }

  const quitAt = new Date(quitAtMs);
  const preQuit = quitAtMs > now.getTime();
  const showEmergingEvidence = data.preferences?.showEmergingEvidence ?? true;

  return (
    <>
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">{m.health.pageTitle}</h1>

        <SegmentedControl
          options={SEGMENTS}
          value={segment}
          onChange={(id) => {
            if (isSegment(id)) setSegment(id);
          }}
          label={m.health.segments.label}
        />

        {segment === 'right-now' ? (
          <RightNowView
            states={states}
            showEmergingEvidence={showEmergingEvidence}
            preQuit={preQuit}
            onOpenMilestone={setSheetMilestone}
          />
        ) : null}

        {segment === 'timeline' ? (
          <TimelineView
            states={states}
            showEmergingEvidence={showEmergingEvidence}
            quitAt={quitAt}
            now={now}
            onOpenMilestone={setSheetMilestone}
          />
        ) : null}

        {segment === 'body' ? (
          <BodyExplorerView states={states} showEmergingEvidence={showEmergingEvidence} />
        ) : null}
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
