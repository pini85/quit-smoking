/**
 * The belief library for the Freedom feature: the 18 promises smoking makes,
 * named so they can be looked at.
 *
 * Source of truth for the catalog, the trigger mapping and the `principleRefs`
 * anchors is the committed research corpus `docs/research/freedom-principles.md`
 * (section B, mapped onto the Carr principles in section A and the behavioural
 * science in section C). Tone is bound by that document's section E: curious,
 * never combative; second person; no exclamation marks.
 *
 * One deliberate exception: `promise` strings are first-person quotes voicing
 * the belief itself, so they carry the smoker's vocabulary, not the app's. The
 * `deprivation` and `willpower-needed` promises use the exact words those
 * beliefs use — that is the point of quoting them — and the tone scan exempts
 * the `promise` field for precisely this reason. Everything the app says in its
 * own voice (labels, categories, and every component built on this data) stays
 * inside the doctrine.
 *
 * Pure data: no React, no clock, no emoji. Presentation metadata lives in the
 * components, as with `data/triggers.ts`.
 */

import type { Belief, Trigger } from '@/domain/types';

/**
 * What kind of promise this is — used to group the belief map. Named after the
 * promise, never after the person holding it.
 */
export const BELIEF_CATEGORIES = [
  'pleasure',
  'coping',
  'ritual',
  'identity',
  'fear',
] as const;
export type BeliefCategory = (typeof BELIEF_CATEGORIES)[number];

export interface BeliefMeta {
  /** Short noun phrase naming the promise, for chips and headings. */
  label: string;
  /** First-person, present-tense quote of the belief in the smoker's own words. */
  promise: string;
  category: BeliefCategory;
  /** Contexts this promise usually shows up in. Every entry is a real Trigger. */
  relatedTriggers: Trigger[];
  /** Section anchors in docs/research/freedom-principles.md that dismantle it. */
  principleRefs: string[];
  /** Dominant evidence class of the dismantling argument. */
  sourceKind: 'carr' | 'psych' | 'med';
}

export const BELIEF_META: Record<Belief, BeliefMeta> = {
  relaxation: {
    label: 'Relaxation',
    promise: 'A cigarette would help me relax',
    category: 'coping',
    relatedTriggers: ['stress', 'habit'],
    principleRefs: ['A4', 'A3'],
    sourceKind: 'med',
  },
  'stress-relief': {
    label: 'Getting through stress',
    promise: "I can't handle stress without cigarettes",
    category: 'coping',
    relatedTriggers: ['stress', 'emotional'],
    principleRefs: ['A4', 'A9', 'C8'],
    sourceKind: 'med',
  },
  'coffee-ritual': {
    label: 'The coffee ritual',
    promise: 'A cigarette completes my coffee',
    category: 'ritual',
    relatedTriggers: ['coffee', 'habit'],
    principleRefs: ['A12', 'A3', 'C1'],
    sourceKind: 'psych',
  },
  'alcohol-pairing': {
    label: 'Drinks and cigarettes',
    promise: "Drinks aren't the same without smoking",
    category: 'ritual',
    relatedTriggers: ['alcohol', 'social'],
    principleRefs: ['A12', 'A11'],
    sourceKind: 'psych',
  },
  'meal-completion': {
    label: 'The one after a meal',
    promise: 'The cigarette after a meal is the best part',
    category: 'ritual',
    relatedTriggers: ['after-food', 'habit'],
    principleRefs: ['A12', 'A3'],
    sourceKind: 'psych',
  },
  concentration: {
    label: 'Focus',
    promise: 'Smoking helps me focus',
    category: 'coping',
    relatedTriggers: ['habit', 'boredom'],
    principleRefs: ['A5'],
    sourceKind: 'med',
  },
  'boredom-relief': {
    label: 'Something to do',
    promise: 'Smoking gives me something to do',
    category: 'pleasure',
    relatedTriggers: ['boredom', 'habit'],
    principleRefs: ['A6'],
    sourceKind: 'psych',
  },
  reward: {
    label: 'The reward',
    promise: "I've earned this one",
    category: 'pleasure',
    relatedTriggers: ['habit', 'emotional'],
    principleRefs: ['A3', 'A7'],
    sourceKind: 'carr',
  },
  'break-permission': {
    label: 'The only real break',
    promise: 'A cigarette is my only real break',
    category: 'ritual',
    relatedTriggers: ['habit', 'stress'],
    principleRefs: ['A12', 'A6', 'C2'],
    sourceKind: 'psych',
  },
  'social-ease': {
    label: 'Social ease',
    promise: 'Social situations are harder without smoking',
    category: 'coping',
    relatedTriggers: ['social', 'alcohol'],
    principleRefs: ['A11', 'A9'],
    sourceKind: 'carr',
  },
  confidence: {
    label: 'A harder case',
    promise: "I'm too addicted — it's harder for me than for other people",
    category: 'identity',
    relatedTriggers: ['stress', 'emotional', 'other'],
    principleRefs: ['A2', 'A17'],
    sourceKind: 'carr',
  },
  identity: {
    label: 'Part of who you are',
    promise: 'Smoking is part of who I am',
    category: 'identity',
    relatedTriggers: ['social', 'seeing-smoking'],
    principleRefs: ['A13', 'A16'],
    sourceKind: 'carr',
  },
  deprivation: {
    label: 'Losing something',
    promise: "I'm giving something up",
    category: 'fear',
    relatedTriggers: ['emotional', 'habit', 'other'],
    principleRefs: ['A7', 'A3'],
    sourceKind: 'carr',
  },
  'just-one': {
    label: 'Just one',
    promise: "Just one won't matter",
    category: 'pleasure',
    relatedTriggers: ['alcohol', 'social', 'emotional'],
    principleRefs: ['A10', 'C7'],
    sourceKind: 'psych',
  },
  'miss-it-forever': {
    label: 'Missing it',
    promise: 'I miss smoking',
    category: 'fear',
    relatedTriggers: ['seeing-smoking', 'habit', 'emotional'],
    principleRefs: ['A16', 'A15'],
    sourceKind: 'psych',
  },
  'always-want': {
    label: 'Always wanting one',
    promise: "I'll always occasionally want one",
    category: 'fear',
    relatedTriggers: ['seeing-smoking', 'habit', 'other'],
    principleRefs: ['A15', 'A2'],
    sourceKind: 'psych',
  },
  'life-worse': {
    label: 'A duller life',
    promise: 'Life will be less enjoyable without smoking',
    category: 'fear',
    relatedTriggers: ['emotional', 'social', 'other'],
    principleRefs: ['A7', 'A3', 'A11'],
    sourceKind: 'carr',
  },
  'willpower-needed': {
    label: 'Not having it in you',
    promise: "I don't have the willpower to quit",
    category: 'identity',
    relatedTriggers: ['emotional', 'stress', 'other'],
    principleRefs: ['A8', 'A17'],
    sourceKind: 'psych',
  },
};

/**
 * House order for browsing the whole library (the belief map, the /brain flow
 * when no trigger narrows it). Everyday, concrete promises first — the ones a
 * smoker recognises immediately — then the beliefs about who you are and what
 * life looks like afterwards, which take longer to see through.
 */
export const BELIEF_ORDER: Belief[] = [
  'relaxation',
  'stress-relief',
  'coffee-ritual',
  'meal-completion',
  'alcohol-pairing',
  'break-permission',
  'boredom-relief',
  'concentration',
  'reward',
  'social-ease',
  'identity',
  'confidence',
  'willpower-needed',
  'deprivation',
  'just-one',
  'miss-it-forever',
  'always-want',
  'life-worse',
];

/**
 * Which promises a craving in this context is most likely to have been making.
 * Ordered most-plausible-first: these become the "What was it promising?" chips
 * after a craving, and the pre-sort for the /brain flow when a trigger is known.
 *
 * 'other' and 'seeing-smoking' get the context-free beliefs — the ones that
 * arrive without needing a coffee or a bar to attach themselves to.
 */
export const TRIGGER_BELIEF_SUGGESTIONS: Record<Trigger, Belief[]> = {
  stress: ['stress-relief', 'relaxation', 'break-permission'],
  boredom: ['boredom-relief', 'break-permission', 'concentration'],
  'after-food': ['meal-completion', 'reward', 'coffee-ritual'],
  coffee: ['coffee-ritual', 'break-permission', 'concentration'],
  alcohol: ['alcohol-pairing', 'just-one', 'social-ease'],
  social: ['social-ease', 'alcohol-pairing', 'identity', 'just-one'],
  habit: ['break-permission', 'reward', 'relaxation', 'concentration'],
  emotional: ['stress-relief', 'reward', 'deprivation', 'miss-it-forever'],
  'seeing-smoking': [
    'miss-it-forever',
    'identity',
    'always-want',
    'deprivation',
  ],
  other: ['always-want', 'deprivation', 'life-worse', 'just-one'],
};
