import type { MilestoneCategory } from '@/domain/types';

/**
 * Finnish text overlay for the 20 milestone category labels. Same ids and
 * emoji as `components/health/categoryMeta.ts` — only the label text differs.
 */
export const FI_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  heart: 'Sydän',
  lungs: 'Keuhkot',
  brain: 'Aivot',
  sleep: 'Uni',
  skin: 'Iho',
  mouth: 'Suu',
  circulation: 'Verenkierto',
  exercise: 'Liikunta',
  senses: 'Aistit',
  immune: 'Immuunijärjestelmä',
  'cancer-risk': 'Syöpäriski',
  'sexual-health': 'Seksuaaliterveys',
  mental: 'Mieli',
  fertility: 'Hedelmällisyys',
  metabolic: 'Aineenvaihdunta',
  eyes: 'Silmät',
  bones: 'Luusto',
  family: 'Perhe',
  freedom: 'Vapaus',
  longevity: 'Pitkäikäisyys',
};
