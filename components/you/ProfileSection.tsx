'use client';

import { useState } from 'react';
import type { QuitProfile } from '@/domain/types';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { formatMoney } from '@/components/home/formatMoney';
import { useLocale, useMessages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { Stepper } from '@/components/welcome/Stepper';
import { CURRENCIES } from '@/components/welcome/StepSmokingProfile';

export type ProfileSectionProps = {
  profile: QuitProfile;
  store: DataStore;
};


function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

/**
 * The onboarding steppers, replayed in-place: same inputs as `StepQuitMoment`
 * (a plain datetime-local, no min/max — unlike onboarding this can move
 * either direction in time) and `StepSmokingProfile`. Fully remounts every
 * time the sheet opens (`Sheet` unmounts its children on close), so its
 * local state always starts from the current `profile` with no reset effect
 * needed.
 */
function ProfileEditForm({
  profile,
  store,
  onDone,
}: {
  profile: QuitProfile;
  store: DataStore;
  onDone: () => void;
}) {
  const m = useMessages();
  const [cigarettesPerDay, setCigarettesPerDay] = useState(profile.cigarettesPerDay);
  const [cigarettesPerPack, setCigarettesPerPack] = useState(profile.cigarettesPerPack);
  const [packPrice, setPackPrice] = useState(profile.packPrice);
  const [currency, setCurrency] = useState(profile.currency);
  const [quitAtText, setQuitAtText] = useState(() => toDatetimeLocalValue(new Date(profile.quitAt)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const parsed = new Date(quitAtText);
    if (!quitAtText || Number.isNaN(parsed.getTime())) {
      setError(m.you.profile.dateWrong);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const now = new Date();
      await store.saveProfile({
        ...profile,
        quitAt: toLocalIso(parsed),
        cigarettesPerDay,
        cigarettesPerPack,
        packPrice,
        currency,
        updatedAt: toLocalIso(now),
      });
      showToast(m.you.profile.updated);
      onDone();
    } catch (err) {
      console.error('Unsmoke: failed to save profile edits', err);
      showToast(m.common.saveFailed);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      <Stepper
        label={m.welcome.smokingProfile.cigarettesPerDay}
        value={cigarettesPerDay}
        onChange={setCigarettesPerDay}
        min={1}
        max={100}
      />
      <Stepper
        label={m.welcome.smokingProfile.cigarettesPerPack}
        value={cigarettesPerPack}
        onChange={setCigarettesPerPack}
        min={1}
        max={60}
      />
      <Stepper
        label={m.welcome.smokingProfile.pricePerPack}
        value={packPrice}
        onChange={setPackPrice}
        min={0}
        max={200}
        step={0.5}
        decimals={2}
      />

      <div>
        <label htmlFor="you-profile-currency" className="mb-2 block text-sm font-medium text-ink">
          {m.welcome.smokingProfile.currency}
        </label>
        <select
          id="you-profile-currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="h-12 w-full rounded-button border border-border bg-surface px-3 text-base text-ink"
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="you-profile-quit-at" className="mb-2 block text-sm font-medium text-ink">
          {m.you.profile.quitMomentLabel}
        </label>
        <input
          id="you-profile-quit-at"
          type="datetime-local"
          value={quitAtText}
          onChange={(event) => setQuitAtText(event.target.value)}
          className="h-12 w-full rounded-button border border-border bg-surface px-3 text-base text-ink"
        />
      </div>

      {error ? (
        // `text-caution`, not `text-danger` — the danger token is reserved
        // for the Danger Zone (task constraint), and a mistyped date isn't
        // destructive anyway.
        <p role="alert" className="text-sm text-caution">
          {error}
        </p>
      ) : null}

      <p className="rounded-card bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        {m.you.profile.recalcNote}
      </p>

      <Button fullWidth size="lg" onClick={() => void handleSave()} disabled={saving}>
        {saving ? m.you.profile.saving : m.you.profile.save}
      </Button>
    </div>
  );
}

export function ProfileSection({ profile, store }: ProfileSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const [editing, setEditing] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{m.you.profile.title}</h2>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          {m.you.profile.edit}
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <Row
          label={m.you.profile.quitMoment}
          value={dateFmt(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(profile.quitAt)
          )}
        />
        <Row label={m.you.profile.cigarettesPerDay} value={String(profile.cigarettesPerDay)} />
        <Row label={m.you.profile.cigarettesPerPack} value={String(profile.cigarettesPerPack)} />
        <Row
          label={m.you.profile.pricePerPack}
          value={formatMoney(profile.packPrice, profile.currency, locale)}
        />
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title={m.you.profile.editSheetTitle}>
        {editing ? (
          <ProfileEditForm profile={profile} store={store} onDone={() => setEditing(false)} />
        ) : null}
      </Sheet>
    </Card>
  );
}

export default ProfileSection;
