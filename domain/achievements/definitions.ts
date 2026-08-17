/**
 * The full catalogue of achievements — pure data, no behavior. Each `fact`
 * is user-facing badge copy: it must state a concrete number or fact (health,
 * money, time), never motivational fluff. See `domain/achievements/engine.ts`
 * for how conditions are evaluated.
 */

import type { AchievementDefinition } from '@/domain/types';

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // --- Time (smoke-free-hours, measured from quitAt) ---
  {
    id: 'first-day',
    title: 'One full day',
    fact: 'Within 24 hours, nicotine has fully cleared from your bloodstream.',
    condition: { type: 'smoke-free-hours', hours: 24 },
    tier: 1,
  },
  {
    id: 'three-days',
    title: 'The peak, passed',
    fact: "Withdrawal symptoms typically peak around day 3 — physically, it's downhill from here.",
    condition: { type: 'smoke-free-hours', hours: 72 },
    tier: 1,
  },
  {
    id: 'one-week',
    title: 'One week free',
    fact: 'By one week, even the last traces of cotinine (a nicotine byproduct) are gone from your body.',
    condition: { type: 'smoke-free-hours', hours: 168 },
    tier: 1,
  },
  {
    id: 'two-weeks',
    title: 'Two weeks',
    fact: 'Between 2 and 12 weeks smoke-free, circulation and lung function are measurably improving.',
    condition: { type: 'smoke-free-hours', hours: 336 },
    tier: 2,
  },
  {
    id: 'one-month',
    title: 'One month',
    fact: "At one month, your lungs' cilia are back at work — 63% of quitters show improved lung clearance.",
    condition: { type: 'smoke-free-hours', hours: 730 },
    tier: 2,
  },
  {
    id: 'hundred-days',
    title: '100 days',
    fact: 'By around 100 days (roughly 3 months), the extra nicotine receptors your brain grew have normalised.',
    condition: { type: 'smoke-free-hours', hours: 2400 },
    tier: 2,
  },
  {
    id: 'six-months',
    title: 'Half a year',
    fact: "By six months, over half of ex-smokers who had a smoker's cough have lost it.",
    condition: { type: 'smoke-free-hours', hours: 4383 },
    tier: 3,
  },
  {
    id: 'one-year',
    title: 'One year — Free',
    fact: 'At one year smoke-free, your added risk of coronary heart disease is about half that of a smoker.',
    condition: { type: 'smoke-free-hours', hours: 8766 },
    tier: 3,
  },

  // --- Cigarettes avoided ---
  {
    id: 'avoided-10',
    title: 'First 10 not smoked',
    fact: "10 cigarettes not smoked — at ~20 minutes of life per cigarette, that's roughly 3 hours of life expectancy reclaimed.",
    condition: { type: 'cigarettes-avoided', count: 10 },
    tier: 1,
  },
  {
    id: 'avoided-100',
    title: '100 not smoked',
    fact: '100 cigarettes not smoked — roughly 33 hours of life expectancy reclaimed.',
    condition: { type: 'cigarettes-avoided', count: 100 },
    tier: 1,
  },
  {
    id: 'avoided-500',
    title: '500 not smoked',
    fact: '500 cigarettes not smoked — roughly 7 days of life expectancy reclaimed.',
    condition: { type: 'cigarettes-avoided', count: 500 },
    tier: 2,
  },
  {
    id: 'avoided-1000',
    title: '1,000 not smoked',
    fact: '1,000 cigarettes not smoked — roughly 2 weeks of life expectancy reclaimed.',
    condition: { type: 'cigarettes-avoided', count: 1000 },
    tier: 3,
  },
  {
    id: 'avoided-5000',
    title: '5,000 not smoked',
    fact: '5,000 cigarettes not smoked — roughly 69 days of life expectancy reclaimed.',
    condition: { type: 'cigarettes-avoided', count: 5000 },
    tier: 3,
  },

  // --- Money (amounts in profile currency) ---
  {
    id: 'saved-10',
    title: 'First 10 saved',
    fact: '10 stayed in your pocket instead of going up in smoke.',
    condition: { type: 'money-saved', amount: 10 },
    tier: 1,
  },
  {
    id: 'saved-50',
    title: '50 saved',
    fact: '50 saved by not buying cigarettes.',
    condition: { type: 'money-saved', amount: 50 },
    tier: 1,
  },
  {
    id: 'saved-100',
    title: '100 kept',
    fact: '100 kept — money that used to disappear a pack at a time.',
    condition: { type: 'money-saved', amount: 100 },
    tier: 2,
  },
  {
    id: 'saved-250',
    title: '250 kept',
    fact: '250 kept and counting, all of it money not spent on cigarettes.',
    condition: { type: 'money-saved', amount: 250 },
    tier: 2,
  },
  {
    id: 'saved-500',
    title: '500 kept',
    fact: '500 kept — money that would otherwise have gone entirely to cigarettes.',
    condition: { type: 'money-saved', amount: 500 },
    tier: 3,
  },
  {
    id: 'saved-1000',
    title: '1,000 kept',
    fact: '1,000 kept, none of it spent on a single cigarette.',
    condition: { type: 'money-saved', amount: 1000 },
    tier: 3,
  },

  // --- Craving victories (cravings-passed = resolved non-smoked count) ---
  {
    id: 'craving-1',
    title: 'First craving, beaten',
    fact: 'You rode out your first craving without smoking — most cravings peak and fade within 3 to 5 minutes.',
    condition: { type: 'cravings-passed', count: 1 },
    tier: 1,
  },
  {
    id: 'craving-10',
    title: '10 cravings beaten',
    fact: '10 cravings beaten — each one passed within minutes, whether or not you smoked.',
    condition: { type: 'cravings-passed', count: 10 },
    tier: 1,
  },
  {
    id: 'craving-25',
    title: '25 beaten',
    fact: '25 cravings beaten without smoking.',
    condition: { type: 'cravings-passed', count: 25 },
    tier: 2,
  },
  {
    id: 'craving-50',
    title: '50 beaten',
    fact: '50 cravings beaten without smoking.',
    condition: { type: 'cravings-passed', count: 50 },
    tier: 2,
  },
  {
    id: 'craving-100',
    title: '100 beaten',
    fact: '100 cravings beaten without smoking — 100 separate moments you chose not to.',
    condition: { type: 'cravings-passed', count: 100 },
    tier: 3,
  },

  // --- Trigger-specific (trigger-passed) ---
  {
    id: 'coffee-10',
    title: 'Coffee, conquered',
    fact: '10 coffee-triggered cravings beaten — breaking one of the most commonly reported smoking cues.',
    condition: { type: 'trigger-passed', trigger: 'coffee', count: 10 },
    tier: 2,
  },
  {
    id: 'stress-10',
    title: 'Stress, survived',
    fact: "10 stress-triggered cravings beaten — proof stress doesn't have to mean a cigarette.",
    condition: { type: 'trigger-passed', trigger: 'stress', count: 10 },
    tier: 2,
  },
  {
    id: 'after-food-10',
    title: 'After-dinner freedom',
    fact: '10 after-meal cravings beaten — the after-food cigarette is no longer automatic.',
    condition: { type: 'trigger-passed', trigger: 'after-food', count: 10 },
    tier: 2,
  },

  // --- Craving-free stretch ---
  {
    id: 'quiet-24h',
    title: 'A quiet day',
    fact: 'A full 24 hours passed without a single logged craving.',
    condition: { type: 'craving-free-hours', hours: 24 },
    tier: 1,
  },
  {
    id: 'quiet-week',
    title: 'A quiet week',
    fact: 'A full 7 days passed without a single logged craving.',
    condition: { type: 'craving-free-hours', hours: 168 },
    tier: 2,
  },

  // --- Weekend ---
  {
    id: 'smoke-free-weekend',
    title: 'First smoke-free weekend',
    fact: 'A full weekend — Friday night to Monday morning — passed without a cigarette.',
    condition: { type: 'smoke-free-weekend', count: 1 },
    tier: 1,
  },
];
