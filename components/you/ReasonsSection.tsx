'use client';

import { useState, type FormEvent } from 'react';
import type { PersonalReason } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type ReasonsSectionProps = {
  reasons: PersonalReason[];
  store: DataStore;
};

/**
 * Reasons manager. Removal is a hard delete via `store.removeReason` —
 * `PersonalReason.archived` is a v2 concern the brief explicitly says to
 * leave unused for now.
 */
export function ReasonsSection({ reasons, store }: ReasonsSectionProps) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await store.addReason({
        id: crypto.randomUUID(),
        text: trimmed,
        createdAt: toLocalIso(new Date()),
      });
      setDraft('');
    } catch (err) {
      console.error('Unsmoke: failed to add reason', err);
      showToast("Couldn't save — please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    try {
      await store.removeReason(id);
    } catch (err) {
      console.error('Unsmoke: failed to remove reason', err);
      showToast("Couldn't remove — please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">My reasons</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">These appear during cravings.</p>
      </div>

      {reasons.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No reasons yet — add one below.</p>
      ) : (
        <ul className="flex flex-col">
          {reasons.map((reason) => (
            <li key={reason.id} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-[14px] text-ink">{reason.text}</span>
              <button
                type="button"
                onClick={() => void handleRemove(reason.id)}
                disabled={removingId === reason.id}
                aria-label={`Remove reason: ${reason.text}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.9] disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a reason"
          aria-label="Add a reason"
          className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-base text-ink"
        />
        <Button type="submit" variant="secondary" disabled={!draft.trim() || adding}>
          Add
        </Button>
      </form>
    </Card>
  );
}

export default ReasonsSection;
