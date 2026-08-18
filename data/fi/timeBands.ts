import type { TimeBandId } from '@/domain/milestones/engine';

/** Finnish overlay for `TIME_BANDS` labels, keyed by the same band ids. */
export const FI_TIME_BAND_LABELS: Record<TimeBandId, string> = {
  'first-20-minutes': 'Ensimmäiset 20 minuuttia',
  'first-day': 'Ensimmäinen päivä',
  'days-2-3': 'Päivät 2–3',
  'first-week': 'Ensimmäinen viikko',
  'weeks-2-4': 'Viikot 2–4',
  'months-1-3': 'Kuukaudet 1–3',
  'months-3-12': 'Kuukaudet 3–12',
  'years-1-5': 'Vuodet 1–5',
  'years-5-15': 'Vuodet 5–15',
  'beyond-15-years': '15+ vuotta',
};
