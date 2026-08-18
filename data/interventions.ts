/**
 * Content for the 7 craving interrupters ("interventions"). One per kind in v1.
 */

import type { Locale } from '@/domain/types';
import { FI_INTERVENTIONS, FI_TRUTH_CARDS } from './fi/interventions';

export type InterventionKind =
  | 'breathing'
  | 'urge-surf'
  | 'delay'
  | 'water'
  | 'scene-change'
  | 'reasons'
  | 'proof';

export interface Intervention {
  id: InterventionKind; // one per kind in v1
  title: string; // e.g. 'Breathe through it'
  tagline: string; // one line shown on the chooser card
  durationMs: number | null; // null for 'reasons' and 'proof' (untimed)
  prompts: string[]; // rotating on-screen lines during the exercise
  requiresReasons?: boolean; // 'reasons'
  requiresTriggerHistory?: boolean; // 'proof'
}

export const TRUTH_CARDS: string[] = [
  "This feeling is nicotine leaving, not a cigarette calling. It ends on its own — usually within minutes.",
  "A cigarette wouldn't end this craving. It would schedule the next one.",
  "You're not giving something up right now. You're getting something back.",
  'This craving has a shape: it rises, it peaks, it fades. You only have to watch it happen.',
  'Every craving you outlast physically weakens the wiring that created it. This one counts.',
  "The 'relief' a cigarette gives is just withdrawal pausing. You're ending the withdrawal for good instead.",
  "You don't need this to pass quickly. You just need to not smoke while it passes. It's already passing.",
  "Smokers have this exact feeling too — between every cigarette. You're having it for one of the last times.",
  "Nothing real in your life gets worse if you don't smoke in the next five minutes. Everything measured in this app gets better.",
  "You've already done the only hard part: you're standing here, not lighting one.",
];

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'breathing',
    title: 'Breathe through it',
    tagline: 'One minute. In for 4, out for 6.',
    durationMs: 60000,
    prompts: [
      'Breathe in…',
      '…and let it go',
      "Longer out than in — that's the switch that calms you",
    ],
  },
  {
    id: 'urge-surf',
    title: 'Ride the wave',
    tagline: 'Cravings crest and fade in about 3 minutes.',
    durationMs: 180000,
    prompts: [
      "Don't fight it. Watch it.",
      'Where do you feel it? Chest? Jaw? Hands?',
      "It's already cresting.",
      'Notice it shrinking without your help.',
      "You're not resisting — you're observing.",
      "It always passes. It's passing now.",
    ],
  },
  {
    id: 'delay',
    title: 'Just wait it out',
    tagline: "Five minutes. That's the whole job.",
    durationMs: 300000,
    prompts: TRUTH_CARDS,
  },
  {
    id: 'water',
    title: 'Cold water',
    tagline: 'Get a glass. Drink it slowly.',
    durationMs: 30000,
    prompts: [
      'Get a glass of cold water.',
      'Drink it slowly. Notice the cold.',
      "Come back when it's done.",
    ],
  },
  {
    id: 'scene-change',
    title: 'Change the scene',
    tagline: 'Cravings live in places. Leave this one.',
    durationMs: 120000,
    prompts: [
      'Stand up.',
      'Different room — or outside.',
      'Cravings are tied to places. You just left one.',
    ],
  },
  {
    id: 'reasons',
    title: 'Your reasons',
    tagline: 'Your own words, when it matters.',
    durationMs: null,
    prompts: [],
    requiresReasons: true,
  },
  {
    id: 'proof',
    title: 'You already proved this',
    tagline: 'Your own record says you win this one.',
    durationMs: null,
    prompts: [],
    requiresTriggerHistory: true,
  },
];

/** Localized {title, tagline, prompts} for an intervention; other fields (durationMs, gates) are structural and locale-independent. */
export function localizedIntervention(
  id: InterventionKind,
  locale: Locale = 'en'
): { title: string; tagline: string; prompts: string[] } {
  const base = INTERVENTIONS.find((i) => i.id === id) as Intervention;
  if (locale === 'fi') return FI_INTERVENTIONS[id];
  return { title: base.title, tagline: base.tagline, prompts: base.prompts };
}

export function localizedTruthCards(locale: Locale = 'en'): string[] {
  return locale === 'fi' ? FI_TRUTH_CARDS : TRUTH_CARDS;
}
