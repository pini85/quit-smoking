import type { Trigger } from '@/domain/types';

/**
 * Finnish trigger text overlay. `label` mirrors `TRIGGER_META[t].label`;
 * `inSentence` is the inflected fragment sentence templates interpolate
 * mid-sentence ("Olet ollut kahvihetkissä 5 kertaa") — Finnish cannot reuse
 * a lowercased nominative label the way English does. Structural fields
 * (ids, emoji, ordering) stay in `data/triggers.ts` and are never forked.
 *
 * Machine-translated, pending native-speaker review — see
 * docs/i18n-finnish-review.md.
 */
export const FI_TRIGGER_TEXT: Record<Trigger, { label: string; inSentence: string }> = {
  stress: { label: 'Stressi', inSentence: 'stressaavissa hetkissä' },
  boredom: { label: 'Tylsyys', inSentence: 'tylsissä hetkissä' },
  'after-food': { label: 'Ruoan jälkeen', inSentence: 'ruokailun jälkeisissä hetkissä' },
  coffee: { label: 'Kahvi', inSentence: 'kahvihetkissä' },
  alcohol: { label: 'Alkoholi', inSentence: 'alkoholin äärellä' },
  social: { label: 'Seura', inSentence: 'seurassa' },
  habit: { label: 'Rutiini', inSentence: 'rutiinihetkissä' },
  emotional: { label: 'Tunteet', inSentence: 'tunnekuohun hetkissä' },
  'seeing-smoking': { label: 'Näit tupakointia', inSentence: 'tupakointia nähdessäsi' },
  other: { label: 'Muu', inSentence: 'tällaisissa hetkissä' },
};
