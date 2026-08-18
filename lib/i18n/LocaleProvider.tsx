'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { isLocale, type Locale } from '@/domain/types';
import { useAppData } from '@/lib/hooks/useAppData';
import { useLocalPref } from '@/lib/hooks/useLocalPref';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { en, type Messages } from './messages/en';
import { fi } from './messages/fi';

/**
 * App language state. The persisted source of truth is
 * `Preferences.locale` in IndexedDB, but that resolves asynchronously —
 * hundreds of milliseconds after hydration — so a Finnish user would see a
 * long flash of English on every launch. The localStorage mirror (read
 * synchronously at hydration via `useLocalPref`) exists solely to close that
 * gap; it is a cache, seeded from IndexedDB when empty, and overwritten on
 * every explicit language change.
 *
 * The prerendered static HTML is English (`<html lang="en">` in the root
 * layout); one hydration frame of English is the floor under
 * `output: 'export'` — there is no server to pick a locale earlier.
 */

export const LOCALE_STORAGE_KEY = 'unsmoke.locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const DICTIONARIES: Record<Locale, Messages> = { en, fi };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { value: mirrored, set: setMirrored } = useLocalPref(LOCALE_STORAGE_KEY);
  const { data, store } = useAppData();
  const dbLocale = data.preferences?.locale;

  // Mirror wins when valid: it was written either by an explicit language
  // change on this device or seeded from IndexedDB below. Falling back to
  // the DB value covers a fresh browser profile restoring from a backup.
  const locale: Locale = isLocale(mirrored) ? mirrored : (dbLocale ?? 'en');

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Seed the mirror from IndexedDB exactly once (mirror empty, DB has a
  // locale) — e.g. first launch after importing a backup on a new device.
  // Never DB → mirror when the mirror already holds a valid locale: during a
  // language change the mirror is deliberately ahead of the async DB write,
  // and syncing that gap backwards would revert the user's choice.
  useEffect(() => {
    if (mirrored === null && dbLocale) setMirrored(dbLocale);
  }, [mirrored, dbLocale, setMirrored]);

  const setLocale = useCallback(
    (next: Locale) => {
      setMirrored(next);
      const now = new Date();
      const base = data.preferences ?? defaultPreferences(now);
      store
        .savePreferences({ ...base, locale: next, updatedAt: toLocalIso(now) })
        .catch((err: unknown) => {
          // The mirror already flipped the UI; the persisted copy catches up
          // on the next successful preferences write.
          console.error('Unsmoke: failed to persist language preference', err);
        });
    },
    [data.preferences, store, setMirrored]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, messages: DICTIONARIES[locale] }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx === null) {
    throw new Error('useLocale/useMessages must be used within <LocaleProvider>');
  }
  return ctx;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

export function useMessages(): Messages {
  return useLocaleContext().messages;
}
