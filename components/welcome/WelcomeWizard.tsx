'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/lib/hooks/useAppData';
import { showToast } from '@/components/ui/Toast';
import { toLocalIso } from '@/lib/utils/iso';
import type { PersonalReason, Preferences, QuitProfile } from '@/domain/types';
import { ProgressDots } from './ProgressDots';
import { StepQuitMoment, type QuitMode } from './StepQuitMoment';
import { RestoreBackup } from './RestoreBackup';
import { StepSmokingProfile } from './StepSmokingProfile';
import { StepReasons } from './StepReasons';

const TOTAL_STEPS = 3;
const THIRTY_DAYS_MS = 30 * 86_400_000;

const SUGGESTED_REASONS = ['My kids', 'Breathing', 'Money', 'Smell', 'Health', 'Freedom'];

const SUPPORTED_CURRENCIES = new Set([
  'EUR',
  'USD',
  'GBP',
  'ILS',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'AUD',
  'CAD',
  'JPY',
]);

// Coarse locale → currency heuristic, per brief ("Intl.NumberFormat locale
// heuristic or EUR"). Only needs to be a reasonable default — the user can
// always change it on step 2.
const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  IL: 'ILS',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  AU: 'AUD',
  CA: 'CAD',
  JP: 'JPY',
};

function guessCurrency(): string {
  try {
    const locale = Intl.NumberFormat().resolvedOptions().locale;
    const region = locale.split('-')[1]?.toUpperCase();
    const guess = region ? REGION_TO_CURRENCY[region] : undefined;
    return guess && SUPPORTED_CURRENCIES.has(guess) ? guess : 'EUR';
  } catch {
    return 'EUR';
  }
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** "Today 09:00", or now if it isn't 9am yet today (never default into the future). */
function defaultAlreadyQuitAt(now: Date): Date {
  const today9 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  return today9.getTime() > now.getTime() ? now : today9;
}

/** Tomorrow 09:00, clamped into [min, max] as a defensive fallback. */
function defaultSoonQuitAt(now: Date, min: Date, max: Date): Date {
  const tomorrow9 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  if (tomorrow9.getTime() < min.getTime()) return min;
  if (tomorrow9.getTime() > max.getTime()) return max;
  return tomorrow9;
}

/**
 * The 3-step first-launch wizard: quit moment → smoking profile → reasons.
 * All client state, no sub-routes — `AppGate` only cares about `/welcome`
 * as a single pathname. Reads and writes happen exclusively in the
 * `finalize` handler (an event handler), never during render.
 */
export function WelcomeWizard() {
  const router = useRouter();
  const { store } = useAppData();

  const [mountedAt] = useState(() => new Date());
  const soonMin = mountedAt;
  const soonMax = new Date(mountedAt.getTime() + THIRTY_DAYS_MS);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [quitMode, setQuitMode] = useState<QuitMode>('now');
  const [alreadyQuitAt, setAlreadyQuitAt] = useState(() =>
    toDatetimeLocalValue(defaultAlreadyQuitAt(mountedAt))
  );
  const [soonQuitAt, setSoonQuitAt] = useState(() =>
    toDatetimeLocalValue(defaultSoonQuitAt(mountedAt, soonMin, soonMax))
  );
  const [quitAtResolved, setQuitAtResolved] = useState<Date | null>(null);

  const [cigarettesPerDay, setCigarettesPerDay] = useState(15);
  const [cigarettesPerPack, setCigarettesPerPack] = useState(20);
  const [packPrice, setPackPrice] = useState(6.5);
  const [currency, setCurrency] = useState<string>(() => guessCurrency());

  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [customReasons, setCustomReasons] = useState<string[]>([]);

  // Guards against a double Start/Skip tap re-entering `finalize`, and lets
  // step 3 disable its buttons for the (usually sub-100ms, but not
  // guaranteed) duration of the write chain.
  const [saving, setSaving] = useState(false);

  function handleQuitMomentContinue(quitAt: Date) {
    setQuitAtResolved(quitAt);
    setStep(2);
  }

  function toggleSuggestion(label: string) {
    setSelectedSuggestions((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  function addCustomReason(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setCustomReasons((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }

  function removeCustomReason(text: string) {
    setCustomReasons((prev) => prev.filter((r) => r !== text));
  }

  async function finalize(reasonTexts: string[]) {
    if (saving) return; // already in flight — ignore a double Start/Skip tap
    setSaving(true);

    try {
      // One shared timestamp for every record this submit creates —
      // both so createdAt/updatedAt genuinely agree with each other, and
      // so `quitAt` for "quitting right now" is captured exactly once, at
      // this final-submit moment (not back at step 1's Continue).
      const now = new Date();
      const nowIso = toLocalIso(now);
      const quitAt = quitMode === 'now' ? now : quitAtResolved ?? now;

      // Order matters: `AppGate` redirects home the instant it sees
      // `profile !== null`, regardless of what page it's watching from —
      // `saveProfile`'s write-through `refresh()` notifies subscribers
      // synchronously-ish (as soon as the read resolves), so if it ran
      // first, AppGate could win the race and navigate away from
      // `/welcome` *before* the reasons/preferences below ever reached
      // disk. Persisting reasons and preferences first, and `saveProfile`
      // last, means that by the time AppGate's redirect can possibly fire,
      // every other record this submit creates is already durable — this
      // component's own `router.replace('/')` right after becomes a
      // harmless no-op duplicate of whichever redirect (its own, or
      // AppGate's) lands first.
      for (const text of reasonTexts) {
        const reason: PersonalReason = {
          id: crypto.randomUUID(),
          text,
          createdAt: nowIso,
        };
        // Sequential on purpose: each reason must be persisted (and the
        // store's snapshot refreshed) before the next `addReason` runs.
        await store.addReason(reason);
      }

      const preferences: Preferences = {
        id: 'singleton',
        theme: 'system',
        showEmergingEvidence: true,
        updatedAt: nowIso,
      };
      await store.savePreferences(preferences);

      const profile: QuitProfile = {
        id: 'singleton',
        quitAt: toLocalIso(quitAt),
        cigarettesPerDay,
        cigarettesPerPack,
        packPrice,
        currency,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await store.saveProfile(profile);

      router.replace('/');
      showToast("That's it. Everything from here is measured, not promised.", {
        withRingPulse: true,
      });
      // Deliberately leave `saving` true on success: this screen is on its
      // way out (via the replace above, or AppGate's), so there's no
      // meaningful "not saving" state to return the buttons to.
    } catch (err) {
      console.error('Unsmoke: failed to save onboarding profile', err);
      showToast('Something went wrong saving your profile. Please try again.');
      setSaving(false);
    }
  }

  function handleSkip() {
    void finalize([]);
  }

  function handleStart() {
    void finalize([...selectedSuggestions, ...customReasons]);
  }

  return (
    <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-col pt-8">
      <div className="mb-8">
        <ProgressDots step={step} total={TOTAL_STEPS} />
      </div>

      {step === 1 ? (
        <StepQuitMoment
          mode={quitMode}
          // Only offered on step 1: past it the user has started answering,
          // and a restore would discard those answers anyway.
          footer={<RestoreBackup store={store} />}
          alreadyQuitAt={alreadyQuitAt}
          soonQuitAt={soonQuitAt}
          soonMin={soonMin}
          soonMax={soonMax}
          onModeChange={setQuitMode}
          onAlreadyChange={setAlreadyQuitAt}
          onSoonChange={setSoonQuitAt}
          onContinue={handleQuitMomentContinue}
        />
      ) : null}

      {step === 2 ? (
        <StepSmokingProfile
          cigarettesPerDay={cigarettesPerDay}
          cigarettesPerPack={cigarettesPerPack}
          packPrice={packPrice}
          currency={currency}
          onCigarettesPerDayChange={setCigarettesPerDay}
          onCigarettesPerPackChange={setCigarettesPerPack}
          onPackPriceChange={setPackPrice}
          onCurrencyChange={setCurrency}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      ) : null}

      {step === 3 ? (
        <StepReasons
          suggestions={SUGGESTED_REASONS}
          selectedSuggestions={selectedSuggestions}
          customReasons={customReasons}
          onToggleSuggestion={toggleSuggestion}
          onAddCustomReason={addCustomReason}
          onRemoveCustomReason={removeCustomReason}
          onBack={() => setStep(2)}
          onSkip={handleSkip}
          onStart={handleStart}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

export default WelcomeWizard;
