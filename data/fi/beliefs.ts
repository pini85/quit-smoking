import type { Belief } from '@/domain/types';

/**
 * Finnish text overlay for the belief library: `label` and first-person
 * `promise` quote per belief, keyed by the same ids as `data/beliefs.ts`.
 * Category, relatedTriggers, principleRefs and sourceKind are structural and
 * stay in the English file — only the text is forked here.
 *
 * Tone matches the English doctrine (docs/research/freedom-principles.md
 * section E): curious, never combative, second person, no exclamation marks.
 * `promise` strings are deliberately first-person and use the smoker's own
 * vocabulary — including "tahdonvoima" (willpower) and "luovun" (giving up)
 * where the belief itself uses those words — exactly as the English
 * `deprivation`/`willpower-needed` entries do; this is quoting the belief,
 * not the app's own voice, so it stays outside the tone scan for the same
 * reason the English promise strings do.
 *
 * Machine-translated, pending native-speaker review — see
 * docs/i18n-finnish-review.md.
 */
export const FI_BELIEF_TEXT: Record<Belief, { label: string; promise: string }> = {
  relaxation: {
    label: 'Rentoutuminen',
    promise: 'Savuke auttaisi minua rentoutumaan',
  },
  'stress-relief': {
    label: 'Stressistä selviäminen',
    promise: 'En selviä stressistä ilman savukkeita',
  },
  'coffee-ritual': {
    label: 'Kahvirituaali',
    promise: 'Savuke täydentää kahvini',
  },
  'alcohol-pairing': {
    label: 'Drinkit ja savukkeet',
    promise: 'Drinkit eivät ole samoja ilman tupakointia',
  },
  'meal-completion': {
    label: 'Aterian jälkeinen',
    promise: 'Savuke aterian jälkeen on paras osa',
  },
  concentration: {
    label: 'Keskittyminen',
    promise: 'Tupakointi auttaa minua keskittymään',
  },
  'boredom-relief': {
    label: 'Jotain tekemistä',
    promise: 'Tupakointi antaa minulle jotain tekemistä',
  },
  reward: {
    label: 'Palkinto',
    promise: 'Olen ansainnut tämän',
  },
  'break-permission': {
    label: 'Ainoa oikea tauko',
    promise: 'Savuke on ainoa oikea taukoni',
  },
  'social-ease': {
    label: 'Sosiaalinen helppous',
    promise: 'Sosiaaliset tilanteet ovat vaikeampia ilman tupakointia',
  },
  confidence: {
    label: 'Vaikeampi tapaus',
    promise: 'Olen liian koukussa — minulle se on vaikeampaa kuin muille',
  },
  identity: {
    label: 'Osa sinua',
    promise: 'Tupakointi on osa sitä, kuka olen',
  },
  deprivation: {
    label: 'Jonkin menettäminen',
    promise: 'Luovun jostain',
  },
  'just-one': {
    label: 'Vain yksi',
    promise: 'Yhdellä ei ole väliä',
  },
  'miss-it-forever': {
    label: 'Kaipaaminen',
    promise: 'Kaipaan tupakointia',
  },
  'always-want': {
    label: 'Aina haluaminen',
    promise: 'Haluan aina silloin tällöin yhden',
  },
  'life-worse': {
    label: 'Tylsempi elämä',
    promise: 'Elämä on vähemmän nautittavaa ilman tupakointia',
  },
  'willpower-needed': {
    label: 'Ei riitä sinuun',
    promise: 'Minulla ei ole tahdonvoimaa lopettaa',
  },
};
