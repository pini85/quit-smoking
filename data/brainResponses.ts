/**
 * Answers to the one question the /brain flow asks: "what is the cigarette
 * promising you right now?"
 *
 * One entry per belief, 2–3 variants each, each written to be read in seconds
 * while a craving is running — a single targeted response, not a lesson. The
 * variants rotate so a returning user isn't read the same sentence twice; each
 * one stands alone, and each speaks to its own belief only.
 *
 * `proofKind: 'trigger-history'` marks the promises the user has already
 * disproved in their own craving log — the ritual and coping ones, which are
 * bound to a context the app records. The UI splices that history in after the
 * line (how many cravings in this context, how many passed). Lines carrying the
 * flag are written to read complete without the splice, in case there is no
 * history yet.
 *
 * Grounded in docs/research/freedom-principles.md; tone bound by its section E
 * (curiosity over combat, no deprivation vocabulary, no exclamation marks) and
 * enforced by tests/domain/freedomContent.test.ts. Medical claims — the stress
 * finding, the concentration dip — are stated with the restraint the evidence
 * supports and appear nowhere else.
 *
 * Pure data: no React, no clock, no emoji.
 */

import type { Belief } from '@/domain/types';

export interface BrainResponse {
  /** 2–3 interchangeable variants, each a complete answer on its own. */
  lines: string[];
  /** Set when the UI should splice in the user's real per-trigger record. */
  proofKind?: 'trigger-history';
}

export const BRAIN_RESPONSES: Record<Belief, BrainResponse> = {
  relaxation: {
    lines: [
      "Calm. What it delivers is the end of the tension it set up an hour ago — back to a baseline you'd never have left.",
      'Nothing has relaxed yet, and nothing needs to. The tight feeling is withdrawal, and it fades on its own whether or not you feed it.',
      'A non-smoker in this exact moment feels fine. The gap between you and them is the addiction, not the situation.',
    ],
    proofKind: 'trigger-history',
  },
  'stress-relief': {
    lines: [
      'That it can make this manageable. But smoking has been adding a low hum of tension between every cigarette — the stress it removes is mostly its own.',
      'Whatever is making this hard will still be there in five minutes either way. The only part smoking touches is the part it created.',
      'People who stop measure lower on stress and anxiety months later, not higher. A modest, well-evidenced effect — and it points away from here.',
    ],
    proofKind: 'trigger-history',
  },
  'coffee-ritual': {
    lines: [
      'To complete the coffee. The coffee is already complete: warm cup, first pause of the day. The cigarette kept turning up and taking the credit.',
      "This is a cue firing, not a need reporting in. Thousands of pairings taught your brain to expect one here, and the expectation fades faster than you'd think.",
      'Keep the cup, the chair, the ten minutes. Let the one part that was never the pleasure go missing, and see whether you notice.',
    ],
    proofKind: 'trigger-history',
  },
  'alcohol-pairing': {
    lines: [
      "That the drink won't be the same. The drink is exactly the same. What changes is that you stay sitting down for it.",
      "The people outside aren't having a better night. They're topping up so their night stays normal.",
      'The drink never tasted of smoke. It tasted of the drink, in between two-minute absences from the table.',
    ],
    proofKind: 'trigger-history',
  },
  'meal-completion': {
    lines: [
      'The best one of the day. It follows the longest gap of the day — that is the entire reason it feels like that.',
      'The full, finished feeling came from the meal. The cigarette arrives late and puts its name on it.',
      'Two more minutes at the table and the same feeling turns up without it. It always did.',
    ],
    proofKind: 'trigger-history',
  },
  concentration: {
    lines: [
      'Focus. Concentration does dip early on — that part is real — and it returns on its own, which is what smoking never let you find out.',
      'Some of it is real: nicotine removes the attentional dip that falling nicotine created, then takes the credit for the return. What it never did was lend you focus you did not have.',
      "The work in front of you is doable at exactly this level of focus. It just won't feel that way for another few minutes.",
    ],
  },
  'boredom-relief': {
    lines: [
      'Something to do. Standing outside holding a small fire is not, on inspection, something to do.',
      "Boredom isn't risky because smoking is interesting. It's risky because nothing else is covering the faint background signal right now.",
      'Take the walk without it and you keep everything that was good about it: the air, the moving, the five minutes off.',
    ],
    proofKind: 'trigger-history',
  },
  reward: {
    lines: [
      'A prize. The prize is a short return to normal, plus an appointment for the next craving.',
      'You did the thing. That already happened, and it stays done whether or not anything gets lit.',
      'Nothing is owed here. Nothing is being taken from you, so there is no debt to settle.',
    ],
  },
  'break-permission': {
    lines: [
      'Permission to stop. Take the break — the break was always the good part, and it does not need a cigarette to be legitimate.',
      'Step outside, ten minutes, no cigarette. Same air, same pause, same escape from the desk. Keep the loop, drop one thing out of it.',
      'The cigarette was the excuse, not the rest. You are allowed the rest on its own terms.',
    ],
    proofKind: 'trigger-history',
  },
  'social-ease': {
    lines: [
      'That it makes this easier. Watch what people actually respond to: "I don\'t smoke" ends the subject in about a second.',
      'The awkwardness it offers to fix is mostly the craving itself. It arrived with the wanting and it leaves with it.',
      "You have been good company in rooms before. That was never the cigarette's doing.",
    ],
    proofKind: 'trigger-history',
  },
  confidence: {
    lines: [
      'That you are a special case, more hooked than other people. That is the belief system talking — and it was installed by the thing making the claim.',
      'People who smoked more than you, for longer than you, are done. The dose was never what decided it.',
      'Being caught in a well-built trap says a lot about the trap. It says nothing about you.',
    ],
  },
  identity: {
    lines: [
      'That this is who you are. You were someone before it, and the character notes are unchanged: same humour, same friends, same taste in everything else.',
      'You stopped being a smoker the moment you stopped, not after a probation period. The wanting takes longer to catch up than the fact does.',
      "'Smoker' was something you did a few times an hour, not a personality. It only looks structural from the inside.",
    ],
  },
  deprivation: {
    lines: [
      'That you are losing something. Name it: what exactly would be gone from your life tonight?',
      'The feeling of loss is the belief that the benefit was real. Nothing is being subtracted here.',
      'You are not going without. You went without for years, in twenty-minute instalments, and called the relief a pleasure.',
    ],
  },
  'just-one': {
    lines: [
      "That this is small and self-contained. The real question isn't one cigarette — it's whether you're a smoker again from tomorrow.",
      'Almost nobody has one. The wiring is still warm, and it takes very little to bring the whole arrangement back.',
      'Whatever it is offering will be gone in a few minutes anyway. The decision it wants lasts years.',
    ],
  },
  'miss-it-forever': {
    lines: [
      'That you will miss this forever. Memory keeps the balcony and the good light and quietly drops the 7am taste and the rain.',
      'Missing it is fine, and it is temporary. The thought can turn up without anything happening next.',
      'Play the whole sequence rather than the edit: the wanting, the going outside, the two minutes, the wanting again.',
    ],
  },
  'always-want': {
    lines: [
      "That it will always be like this. Cravings don't stay this size — they come less often and land smaller, without you doing anything about it.",
      'Every cue you meet without smoking loosens the link a little. Ordinary learning, running whether you notice it or not.',
      'One honest caveat: a genuinely new setting can wake an old association up. That is not the start of it all again. It is one more rep.',
    ],
  },
  'life-worse': {
    lines: [
      "A duller life. That picture is painted by the thing you're leaving, and it has an interest in the result.",
      'Meals, drinks, company, music — none of that was produced by smoking. It was interrupted by it, at intervals, for years.',
      'The other side is not this life minus something. It is this life without a small crisis scheduled through it.',
    ],
  },
  'willpower-needed': {
    lines: [
      'That this needs a kind of person you are not. What predicts stopping is what you believe a cigarette does for you, and that is changeable.',
      'White-knuckling means talking yourself out of something you still want, several times a day. Losing that argument once says nothing about you.',
      'You do not have to want one and say no forever. The job is to stop wanting it, which is a different job with a different ending.',
    ],
  },
};
