'use client';

import { LOCALES, type Locale } from '@/domain/types';
import { useLocale, useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';

// Each language is named in itself, never translated — a user stuck in the
// wrong language must be able to recognize their own.
const NATIVE_NAMES: Record<Locale, string> = { en: 'English', fi: 'Suomi' };

export function LanguageSection() {
  const { locale, setLocale } = useLocale();
  const m = useMessages();

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-ink">{m.you.language.title}</h2>

      <div role="radiogroup" aria-label={m.you.language.title} className="flex gap-2">
        {LOCALES.map((option) => {
          const selected = locale === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={option}
              onClick={() => setLocale(option)}
              className={`min-h-11 flex-1 rounded-button border px-3 text-[14px] font-medium ${
                selected
                  ? 'border-primary bg-surface text-ink'
                  : 'border-border bg-surface text-ink-muted'
              }`}
            >
              {NATIVE_NAMES[option]}
            </button>
          );
        })}
      </div>

      {locale === 'fi' ? (
        <p className="text-[12px] leading-relaxed text-ink-faint">{m.you.language.medicalNote}</p>
      ) : null}
    </Card>
  );
}

export default LanguageSection;
