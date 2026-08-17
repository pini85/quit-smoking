'use client';

import { Button } from '@/components/ui/Button';
import { Stepper } from './Stepper';

// Common ISO 4217 codes, per brief.
export const CURRENCIES = [
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
] as const;

export type StepSmokingProfileProps = {
  cigarettesPerDay: number;
  cigarettesPerPack: number;
  packPrice: number;
  currency: string;
  onCigarettesPerDayChange: (value: number) => void;
  onCigarettesPerPackChange: (value: number) => void;
  onPackPriceChange: (value: number) => void;
  onCurrencyChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepSmokingProfile({
  cigarettesPerDay,
  cigarettesPerPack,
  packPrice,
  currency,
  onCigarettesPerDayChange,
  onCigarettesPerPackChange,
  onPackPriceChange,
  onCurrencyChange,
  onBack,
  onContinue,
}: StepSmokingProfileProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button variant="ghost" onClick={onBack} className="-ml-2 mb-2 px-2">
          Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Your smoking, in numbers.
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        <Stepper
          label="Cigarettes per day"
          value={cigarettesPerDay}
          onChange={onCigarettesPerDayChange}
          min={1}
          max={100}
        />
        <Stepper
          label="Cigarettes per pack"
          value={cigarettesPerPack}
          onChange={onCigarettesPerPackChange}
          min={1}
          max={60}
        />
        <Stepper
          label="Price per pack"
          value={packPrice}
          onChange={onPackPriceChange}
          min={0}
          max={200}
          step={0.5}
          decimals={2}
        />

        <div>
          <label htmlFor="currency" className="mb-2 block text-sm font-medium text-ink">
            Currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
            className="h-12 w-full rounded-button border border-border bg-surface px-3 text-base text-ink"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-ink-faint">
        Used only to calculate what you&apos;re getting back. Stays on this phone.
      </p>

      <div className="mt-auto pb-6">
        <Button fullWidth size="lg" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export default StepSmokingProfile;
