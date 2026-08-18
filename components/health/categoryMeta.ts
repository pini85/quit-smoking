import type { Locale, MilestoneCategory } from '@/domain/types';
import { FI_CATEGORY_LABELS } from '@/data/fi/categoryMeta';

/**
 * Display metadata for the 20 milestone categories. Lives under
 * `components/health/` (not `data/`) because it is presentation only — the
 * dataset itself stays free of emoji and UI wording.
 */
export const CATEGORY_META: Record<MilestoneCategory, { label: string; emoji: string }> = {
  heart: { label: 'Heart', emoji: '❤️' },
  lungs: { label: 'Lungs', emoji: '🫁' },
  brain: { label: 'Brain', emoji: '🧠' },
  sleep: { label: 'Sleep', emoji: '😴' },
  skin: { label: 'Skin', emoji: '✨' },
  mouth: { label: 'Mouth', emoji: '😁' },
  circulation: { label: 'Circulation', emoji: '🩸' },
  exercise: { label: 'Exercise', emoji: '🏃' },
  senses: { label: 'Senses', emoji: '👃' },
  immune: { label: 'Immune system', emoji: '🛡️' },
  'cancer-risk': { label: 'Cancer risk', emoji: '📉' },
  'sexual-health': { label: 'Sexual health', emoji: '💞' },
  mental: { label: 'Mind', emoji: '🧘' },
  fertility: { label: 'Fertility', emoji: '🌱' },
  metabolic: { label: 'Metabolic', emoji: '⚖️' },
  eyes: { label: 'Eyes', emoji: '👁️' },
  bones: { label: 'Bones', emoji: '🦴' },
  family: { label: 'Family', emoji: '👨‍👩‍👧' },
  freedom: { label: 'Freedom', emoji: '🕊️' },
  longevity: { label: 'Longevity', emoji: '⏳' },
};

export function categoryLabel(category: MilestoneCategory, locale: Locale = 'en'): string {
  return locale === 'fi' ? FI_CATEGORY_LABELS[category] : CATEGORY_META[category].label;
}

export default CATEGORY_META;
