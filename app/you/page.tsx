'use client';

import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { AchievementsGrid } from '@/components/you/AchievementsGrid';
import { ProfileSection } from '@/components/you/ProfileSection';
import { ReasonsSection } from '@/components/you/ReasonsSection';
import { EquivalentsSection } from '@/components/you/EquivalentsSection';
import { LanguageSection } from '@/components/you/LanguageSection';
import { DataSection } from '@/components/you/DataSection';
import { InstallCard } from '@/components/you/InstallCard';
import { AboutSection } from '@/components/you/AboutSection';
import { DangerZone } from '@/components/you/DangerZone';

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

/**
 * You — achievements, profile/reasons/money-equivalents management, data
 * portability, install hint, about, and the danger zone. `AppGate` already
 * guarantees a profile exists on every non-`/welcome` route, but this still
 * defends against the one render before that data is ready (matches
 * `ProgressPage`'s own guard).
 */
export default function YouPage() {
  const { data, store } = useAppData();
  const now = useNow(60_000);
  const m = useMessages();

  if (data.status !== 'ready' || data.profile === null) {
    return <Skeleton />;
  }

  const { profile, cravings, achievementUnlocks, reasons, preferences } = data;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">{m.chrome.tabs.you}</h1>

      <AchievementsGrid
        profile={profile}
        cravings={cravings}
        unlocks={achievementUnlocks}
        store={store}
        now={now}
      />
      <ProfileSection profile={profile} store={store} />
      <ReasonsSection reasons={reasons} store={store} />
      <EquivalentsSection profile={profile} preferences={preferences} store={store} />
      <LanguageSection />
      <DataSection preferences={preferences} cravings={cravings} store={store} now={now} />
      <InstallCard preferences={preferences} store={store} />
      <AboutSection />
      <DangerZone profile={profile} preferences={preferences} store={store} />
    </div>
  );
}
