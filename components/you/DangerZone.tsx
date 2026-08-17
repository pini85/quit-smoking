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
      showToast('Fresh start. Day zero, on purpose.');
    } catch (err) {
      console.error('Unsmoke: failed to start a fresh quit', err);
      showToast("Couldn't save — please try again.");
    } finally {
      setFreshStartBusy(false);
    }
  }

  async function handleExportFirst() {
    if (exportingFirst) return;
    setExportingFirst(true);
    try {
      await runExport(store, preferences);
      showToast('Exported');
    } catch (err) {
      console.error('Unsmoke: failed to export data', err);
      showToast("Couldn't export — please try again.");
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
      showToast("Couldn't erase — please try again.");
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
        <span className="text-[15px] font-semibold text-danger">Danger zone</span>
        <span aria-hidden="true" className="text-ink-faint">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button variant="secondary" fullWidth onClick={() => setFreshStartOpen(true)}>
            Start a fresh quit
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              setEraseArmed(false);
              setEraseOpen(true);
            }}
          >
            Erase everything
          </Button>
        </div>
      ) : null}

      <Sheet open={freshStartOpen} onClose={() => setFreshStartOpen(false)} title="Start a fresh quit">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">
            Sets a new quit moment starting now. Your craving history, achievements and money
            totals stay. Your smoke-free clock and health timeline restart.
          </p>
          <Button fullWidth onClick={() => void handleFreshStart()} disabled={freshStartBusy}>
            {freshStartBusy ? 'Starting…' : 'Start fresh'}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setFreshStartOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={eraseOpen} onClose={closeEraseSheet} title="Erase everything">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink">
            Deletes all data on this device permanently. Export first if you want a backup.
          </p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => void handleExportFirst()}
            disabled={exportingFirst || erasing}
          >
            {exportingFirst ? 'Exporting…' : 'Export first'}
          </Button>
          <Button variant="danger" fullWidth onClick={handleEraseTap} disabled={erasing}>
            {erasing ? 'Erasing…' : eraseArmed ? 'Tap again to erase' : 'Erase'}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

export default DangerZone;
