import type { Locale, Trigger } from '@/domain/types';
import { FI_TRIGGER_TEXT } from './fi/triggers';

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

export function triggerLabel(trigger: Trigger, locale: Locale = 'en'): string {
  return locale === 'fi' ? FI_TRIGGER_TEXT[trigger].label : TRIGGER_META[trigger].label;
}

/**
 * The trigger as a mid-sentence fragment. English is the lowercased label
 * (exactly what call sites always interpolated); Finnish is a genuinely
 * inflected form from the overlay.
 */
export function triggerInSentence(trigger: Trigger, locale: Locale = 'en'): string {
  return locale === 'fi'
    ? FI_TRIGGER_TEXT[trigger].inSentence
    : TRIGGER_META[trigger].label.toLowerCase();
}

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
