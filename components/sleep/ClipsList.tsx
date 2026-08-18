'use client';

import { useMemo, useState } from 'react';
import type { SleepSession } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepRecorder } from '@/lib/recorder/types';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { deleteClipsAndUpdateSessions } from './sleepService';

export type ClipsListProps = {
  recorder: SleepRecorder;
  store: DataStore;
  session: SleepSession;
};

type ClipEntry = { clipPath: string; url: string };

/**
 * One `<audio>` per kept clip on the latest analyzed night. A clip whose
 * `getClipUrl` resolves to `null`, or whose element fires `onError` (file
 * missing/corrupt), is hidden rather than shown broken — the surrounding
 * night's stats stand on their own either way.
 */
export function ClipsList({ recorder, store, session }: ClipsListProps) {
  const m = useMessages();
  const [hidden, setHidden] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const clips: ClipEntry[] = useMemo(() => {
    const entries: ClipEntry[] = [];
    for (const event of session.events ?? []) {
      if (event.clipPath === undefined || hidden.includes(event.clipPath)) continue;
      const url = recorder.getClipUrl(event.clipPath);
      if (url !== null) entries.push({ clipPath: event.clipPath, url });
    }
    return entries;
  }, [session.events, recorder, hidden]);

  if (clips.length === 0) return null;

  async function handleDelete(clipPath: string) {
    if (deleting !== null) return;
    setDeleting(clipPath);
    try {
      await deleteClipsAndUpdateSessions(recorder, store, [session], [clipPath]);
    } catch (err) {
      console.error('Unsmoke: failed to delete a snore clip', err);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.clips.title}</h2>
      <ul className="flex flex-col gap-3">
        {clips.map(({ clipPath, url }) => (
          <li key={clipPath} className="flex items-center gap-2">
            <audio
              controls
              src={url}
              className="h-11 flex-1"
              onError={() => setHidden((prev) => [...prev, clipPath])}
            />
            <button
              type="button"
              onClick={() => void handleDelete(clipPath)}
              disabled={deleting === clipPath}
              aria-label={m.sleep.clips.delete}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.9] disabled:opacity-40"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default ClipsList;
