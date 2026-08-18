'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Preferences, QuitProfile } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { getAppRepositories } from '@/lib/services/appDb';
import { toLocalIso } from '@/lib/utils/iso';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { useMessages } from '@/lib/i18n';
import { runExport } from './DataSection';

export type DangerZoneProps = {
  profile: QuitProfile;
  preferences: Preferences | null;
  store: DataStore;
};

/**
 * Collapsed by default; the only place in the app the `danger` button/text
 * tokens are used, per the brief's constraint.
 */
export function DangerZone({ profile, preferences, store }: DangerZoneProps) {
  const router = useRouter();
  const m = useMessages();

  const [expanded, setExpanded] = useState(false);
  const [freshStartOpen, setFreshStartOpen] = useState(false);
  const [freshStartBusy, setFreshStartBusy] = useState(false);

  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseArmed, setEraseArmed] = useState(false);
  const [exportingFirst, setExportingFirst] = useState(false);
  const [erasing, setErasing] = useState(false);

  async function handleFreshStart() {
    if (freshStartBusy) return;
    setFreshStartBusy(true);
    try {
      const now = new Date();
      await store.saveProfile({ ...profile, quitAt: toLocalIso(now), updatedAt: toLocalIso(now) });
      setFreshStartOpen(false);
      showToast(m.you.dangerZone.freshStartDone);
    } catch (err) {
      console.error('Unsmoke: failed to start a fresh quit', err);
      showToast(m.common.saveFailed);
    } finally {
      setFreshStartBusy(false);
    }
  }

  async function handleExportFirst() {
    if (exportingFirst) return;
    setExportingFirst(true);
    try {
      await runExport(store, preferences);
      showToast(m.you.data.exported);
    } catch (err) {
      console.error('Unsmoke: failed to export data', err);
      showToast(m.you.data.couldNotExport);
    } finally {
      setExportingFirst(false);
    }
  }

  function handleEraseTap() {
    if (erasing) return;
    if (!eraseArmed) {
      setEraseArmed(true);
      return;
    }
    void handleErase();
  }

  async function handleErase() {
    if (erasing) return;
    setErasing(true);
    try {
      const repos = getAppRepositories();
      await repos.clearAll();
      await store.refresh();
      router.replace('/welcome');
    } catch (err) {
      console.error('Unsmoke: failed to erase data', err);
      showToast(m.you.dangerZone.couldNotErase);
      setErasing(false);
      setEraseArmed(false);
    }
  }

  function closeEraseSheet() {
    setEraseOpen(false);
    setEraseArmed(false);
  }

  return (
    <Card className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] font-semibold text-danger">{m.you.dangerZone.title}</span>
        <span aria-hidden="true" className="text-ink-faint">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button variant="secondary" fullWidth onClick={() => setFreshStartOpen(true)}>
            {m.you.dangerZone.startFreshQuit}
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              setEraseArmed(false);
              setEraseOpen(true);
            }}
          >
            {m.you.dangerZone.eraseEverything}
          </Button>
        </div>
      ) : null}

      <Sheet
        open={freshStartOpen}
        onClose={() => setFreshStartOpen(false)}
        title={m.you.dangerZone.freshStartTitle}
      >
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">{m.you.dangerZone.freshStartBody}</p>
          <Button fullWidth onClick={() => void handleFreshStart()} disabled={freshStartBusy}>
            {freshStartBusy ? m.you.dangerZone.starting : m.you.dangerZone.startFresh}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setFreshStartOpen(false)}>
            {m.you.dangerZone.cancel}
          </Button>
        </div>
      </Sheet>

      <Sheet open={eraseOpen} onClose={closeEraseSheet} title={m.you.dangerZone.eraseTitle}>
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">{m.you.dangerZone.eraseBody}</p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => void handleExportFirst()}
            disabled={exportingFirst || erasing}
          >
            {exportingFirst ? m.you.dangerZone.exporting : m.you.dangerZone.exportFirst}
          </Button>
          <Button variant="danger" fullWidth onClick={handleEraseTap} disabled={erasing}>
            {erasing
              ? m.you.dangerZone.erasing
              : eraseArmed
                ? m.you.dangerZone.tapAgainToErase
                : m.you.dangerZone.erase}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export default DangerZone;
