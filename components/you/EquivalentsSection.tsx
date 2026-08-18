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
import { interpolate, useLocale, useMessages } from '@/lib/i18n';

export type EquivalentsSectionProps = {
  profile: QuitProfile;
  preferences: Preferences | null;
  store: DataStore;
};

/**
 * Manager for `preferences.moneyEquivalents` — the "how many dinners out is
 * that" list `StatsRow`/`moneyEquivalentsFor` read from elsewhere. Amounts
 * are stored raw, in the profile's currency, with no conversion — per the
 * brief, that applies to the seeded examples too.
 */
export function EquivalentsSection({ profile, preferences, store }: EquivalentsSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const seedEquivalents: MoneyEquivalent[] = [
    { label: m.you.equivalents.seedDinner, unitPrice: 30 },
    { label: m.you.equivalents.seedCinema, unitPrice: 12 },
    { label: m.you.equivalents.seedCoffeeMonth, unitPrice: 45 },
  ];
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
      showToast(m.common.saveFailed);
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
        <h2 className="text-[15px] font-semibold text-ink">{m.you.equivalents.title}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">{m.you.equivalents.subtitle}</p>
      </div>

      {list.length === 0 ? (
        <Button variant="secondary" onClick={() => void persist(seedEquivalents)} disabled={saving}>
          {m.you.equivalents.addExamples}
        </Button>
      ) : (
        <ul className="flex flex-col">
          {list.map((eq, index) => (
            <li key={`${eq.label}-${index}`} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-[14px] text-ink">
                {eq.label} — {formatMoney(eq.unitPrice, profile.currency, locale)}
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(index)}
                disabled={saving}
                aria-label={interpolate(m.you.equivalents.removeAriaLabel, { label: eq.label })}
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
            placeholder={m.you.equivalents.labelPlaceholder}
            aria-label={m.you.equivalents.labelAriaLabel}
            className="h-12 min-w-0 flex-1 rounded-button border border-border bg-surface px-3 text-base text-ink"
          />
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={m.you.equivalents.pricePlaceholder}
            aria-label={m.you.equivalents.priceAriaLabel}
            className="h-12 w-24 shrink-0 rounded-button border border-border bg-surface px-3 text-base text-ink"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={!label.trim() || !price || saving}
        >
          {m.you.equivalents.add}
        </Button>
      </form>
    </Card>
  );
}

export default EquivalentsSection;
