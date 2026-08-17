import type { Trigger } from '@/domain/types';

export const TRIGGER_META: Record<Trigger, { label: string; emoji: string }> = {
  stress: { label: 'Stress', emoji: '⚡' },
  boredom: { label: 'Boredom', emoji: '🕐' },
  'after-food': { label: 'After food', emoji: '🍽️' },
  coffee: { label: 'Coffee', emoji: '☕' },
  alcohol: { label: 'Alcohol', emoji: '🍺' },
  social: { label: 'Social', emoji: '👥' },
  habit: { label: 'Routine', emoji: '🔁' },
  emotional: { label: 'Emotional', emoji: '💭' },
  'seeing-smoking': { label: 'Saw someone', emoji: '👀' },
  other: { label: 'Other', emoji: '➕' },
};

export const TRIGGER_ORDER: Trigger[] = [
  'stress',
  'coffee',
  'after-food',
  'alcohol',
  'social',
  'boredom',
  'habit',
  'emotional',
  'seeing-smoking',
  'other',
];
