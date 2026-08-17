'use client';

import { useState, type FormEvent } from 'react';
import type { MoneyEquivalent, Preferences, QuitProfile } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { formatMoney } from '@/components/home/formatMoney';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';

export type EquivalentsSectionProps = {
  profile: QuitProfile;
  preferences: Preferences | null;
  store: DataStore;
};

const SEED_EQUIVALENTS: MoneyEquivalent[] = [
  { label: 'a dinner out', unitPrice: 30 },
  { label: 'a cinema ticket', unitPrice: 12 },
  { label: 'a month of coffee', unitPrice: 45 },
];

/**
 * Manager for `preferences.moneyEquivalents` — the "how many dinners out is
 * that" list `StatsRow`/`moneyEquivalentsFor` read from elsewhere. Amounts
 * are stored raw, in the profile's currency, with no conversion — per the
 * brief, that applies to the seeded examples too.
 */
export function EquivalentsSection({ profile, preferences, store }: EquivalentsSectionProps) {
  const list = preferences?.moneyEquivalents ?? [];
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function persist(next: MoneyEquivalent[]) {
    if (saving) return;
    setSaving(true);
    try {
      const now = new Date();
      const base = preferences ?? defaultPreferences(now);
      await store.savePreferences({ ...base, moneyEquivalents: next, updatedAt: toLocalIso(now) });
    } catch (err) {
      console.error('Unsmoke: failed to save money equivalents', err);
      showToast("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const parsedPrice = Number(price);
    if (!trimmedLabel || !Number.isFinite(parsedPrice) || parsedPrice <= 0) return;
    await persist([...list, { label: trimmedLabel, unitPrice: parsedPrice }]);
    setLabel('');
    setPrice('');
  }

  async function handleRemove(index: number) {
    await persist(list.filter((_, i) => i !== index));
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Money equivalents</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Make savings tangible.</p>
      </div>

      {list.length === 0 ? (
        <Button variant="secondary" onClick={() => void persist(SEED_EQUIVALENTS)} disabled={saving}>
          Add examples
        </Button>
      ) : (
        <ul className="flex flex-col">
          {list.map((eq, index) => (
            <li key={`${eq.label}-${index}`} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-[14px] text-ink">
                {eq.label} — {formatMoney(eq.unitPrice, profile.currency)}
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(index)}
                disabled={saving}
                aria-label={`Remove ${eq.label}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.9] disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (e.g. a dinner out)"
            aria-label="Equivalent label"
            className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-base text-ink"
          />
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="Price"
            aria-label="Equivalent price"
            className="h-12 w-24 shrink-0 rounded-button border border-border bg-surface px-3 text-base text-ink"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={!label.trim() || !price || saving}
        >
          Add
        </Button>
      </form>
    </Card>
  );
}

export default EquivalentsSection;
