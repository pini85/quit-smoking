/**
 * The Freedom lesson library: short reads that take one belief apart.
 *
 * Two kinds, one shape:
 *
 * - **booster** — the daily reset, 30–90 seconds. One teachable idea (`idea`),
 *   one thing to watch for today (`notice`), one question to sit with
 *   (`reflect`). Never a motivational quote; every booster teaches something
 *   specific enough to be wrong.
 * - **exercise** — catch-the-lie, in the Notice → Question → Reframe order of
 *   cognitive restructuring (research doc C5). `notice` is the moment to catch,
 *   `reflect` is the question to put to it, `idea` is what turns out to be true.
 *   The UI closes an exercise with an optional conviction rating.
 *
 * Every lesson cites `docs/research/freedom-principles.md` by section anchor and
 * declares the evidence class it is actually standing on. `carr` means a
 * persuasive reframe, honestly labelled; `psych` means a behavioural-science
 * finding; `med` is reserved for clinical evidence and is stated with the
 * restraint that evidence supports. Tone is bound by section E of that document:
 * curiosity over combat, no deprivation vocabulary, no exclamation marks. The
 * suite in tests/domain/freedomContent.test.ts enforces all of that mechanically.
 *
 * The type lives here rather than in domain/types.ts because nothing structural
 * is persisted — durable state stores lesson ids, never lesson bodies, the same
 * arrangement `data/interventions.ts` uses.
 *
 * Pure data: no React, no clock, no emoji.
 */

import type { Belief, Trigger } from '@/domain/types';

export type FreedomLessonKind = 'booster' | 'exercise';

export interface FreedomLesson {
  id: string;
  kind: FreedomLessonKind;
  /** Short headline for the card. */
  title: string;
  /** Booster: the teachable idea. Exercise: the reframe the exercise lands on. */
  idea: string;
  /** Booster: what to watch for today. Exercise: the moment to catch. */
  notice?: string;
  /** The single question. Always ends in a question mark. */
  reflect?: string;
  /** Beliefs this lesson dismantles — at least one, all real ids. */
  beliefIds: Belief[];
  /** Contexts it speaks to. Never 'other': that is a user selection, not a context. */
  triggerIds: Trigger[];
  /** Evidence class of this lesson's argument, honestly declared. */
  sourceKind: 'carr' | 'psych' | 'med';
  /** Section anchors in docs/research/freedom-principles.md. */
  principleRefs: string[];
}

export const FREEDOM_LESSONS: FreedomLesson[] = [
  // --- Boosters ------------------------------------------------------------
  {
    id: 'tight-shoes',
    kind: 'booster',
    title: 'The tight shoes',
    idea: "Take off shoes two sizes too small and the relief is enormous. Nothing good happened to your feet — a discomfort ended, and you came back to how everyone else feels all day. That is the whole mechanism of a cigarette. It doesn't add pleasure on top of your baseline. It returns you, briefly, to the baseline a non-smoker never left.",
    notice:
      'Today, when a cigarette sounds good, check what the good part actually is: something arriving, or something stopping.',
    reflect:
      'When did a cigarette last make a good moment better, rather than make an uncomfortable one stop?',
    beliefIds: ['relaxation', 'reward', 'life-worse'],
    triggerIds: ['habit', 'emotional'],
    sourceKind: 'carr',
    principleRefs: ['A3'],
  },
  {
    id: 'the-longest-gap-tell',
    kind: 'booster',
    title: 'The best ones follow the longest gaps',
    idea: "Rank the cigarettes people call their best: first of the morning, after a long flight, the one after a meeting that overran. The pattern isn't pleasure, it's the length of the gap before it. The deeper the manufactured dip, the better the return to normal feels. Your favourites were never the nicest ones. They were the hungriest.",
    notice:
      'Today, when a moment seems to want a cigarette, count back to when the last one would have been.',
    reflect: "Which of your 'best' cigarettes followed the longest gaps?",
    beliefIds: ['meal-completion', 'coffee-ritual', 'reward'],
    triggerIds: ['after-food', 'coffee', 'habit'],
    sourceKind: 'carr',
    principleRefs: ['A3', 'A12'],
  },
  {
    id: 'stress-goes-down-from-here',
    kind: 'booster',
    title: 'Stress goes down from here',
    idea: 'Between cigarettes, withdrawal runs as a low background hum of tension, and each cigarette quiets the hum it created. That much is a reframe. The measured part: people who stop smoking show lower anxiety, depression and stress months later than people who carry on, with an effect size comparable to antidepressants (Taylor, BMJ 2014; Cochrane 2021). Modest, well evidenced, and it points one way.',
    notice:
      "Today, notice tension you'd normally file as stress arriving on a schedule rather than from anything that happened.",
    reflect:
      'If the smoking was adding tension of its own, how much of your day was borrowed from it?',
    beliefIds: ['relaxation', 'stress-relief'],
    triggerIds: ['stress', 'emotional'],
    sourceKind: 'med',
    principleRefs: ['A4', 'C8'],
  },
  {
    id: 'the-focus-dip-is-real',
    kind: 'booster',
    title: 'The dip in focus is real, and short',
    idea: "The honest version: concentration genuinely dips in early withdrawal. That is a documented effect, not an illusion, and pretending otherwise would insult your own experience. What's untrue is the conclusion drawn from it. Smoking never lent you focus — it kept removing a dip it kept creating. The dip is temporary, and it stops renewing itself once the cycle does.",
    notice:
      "Today, when focus goes, name it as withdrawal passing through rather than as an ability you've mislaid.",
    reflect:
      'How many times has your attention come back on its own, with nothing smoked?',
    beliefIds: ['concentration'],
    triggerIds: ['habit', 'boredom'],
    sourceKind: 'med',
    principleRefs: ['A5'],
  },
  {
    id: 'the-cue-not-the-cigarette',
    kind: 'booster',
    title: 'Your brain learned the cue',
    idea: "Twenty years at a pack a day is something like 1.5 million puff-level pairings. Learning that heavy doesn't stay attached to the drug: dopamine signalling shifts onto whatever reliably predicts it — the kettle, the car door, the first sip, the walk to the same doorway. So when the coffee seems to want a cigarette, that is a prediction firing on time, not a need reporting in.",
    notice:
      'Today, catch the exact cue that starts it — the object, the sound, the doorway — before the wanting finds words.',
    reflect: 'Which cue in your day is doing the most talking?',
    beliefIds: ['coffee-ritual', 'break-permission', 'always-want'],
    triggerIds: ['coffee', 'habit', 'after-food'],
    sourceKind: 'psych',
    principleRefs: ['C1', 'A12'],
  },
  {
    id: 'every-pass-is-a-rep',
    kind: 'booster',
    title: 'Every pass is a rep',
    idea: "Each time a cue turns up and nothing is smoked, the link between them weakens. That is ordinary learning running in your favour, and it works whether or not you were paying attention. Two honest caveats: it's gradual, and it's context-specific. A first drink in an unfamiliar city can feel like week one again. That isn't backsliding — it's the same learning meeting a new room.",
    notice:
      'Today, count one cue you met without smoking. It counted whether or not it felt like anything at the time.',
    reflect: 'Which context have you already rewired without noticing?',
    beliefIds: ['always-want', 'confidence'],
    triggerIds: ['habit', 'seeing-smoking'],
    sourceKind: 'psych',
    principleRefs: ['C3', 'A2'],
  },
  {
    id: 'two-words-that-end-it',
    kind: 'booster',
    title: 'Two words that end the conversation',
    idea: '"I don\'t smoke" and "I\'m trying to quit" get very different responses, and the difference has been measured. "I don\'t" reads as identity: settled, nothing further to discuss. "I can\'t" reads as a rule someone imposed on you, which invites negotiation — from them, and then from you. Same refusal, different structure. Have the first one ready before the offer arrives.',
    notice:
      "Today, say the words once, out loud or under your breath, before you're anywhere you'd need them.",
    reflect: 'Whose offer are you most likely to be answering this week?',
    beliefIds: ['social-ease', 'alcohol-pairing', 'identity'],
    triggerIds: ['social', 'alcohol'],
    sourceKind: 'psych',
    principleRefs: ['A11'],
  },
  {
    id: 'thoughts-are-allowed',
    kind: 'booster',
    title: "You don't have to stop thinking about it",
    idea: "Try not to think of a white bear and you'll think of little else. Suppression makes a thought bigger — reliably enough that it has a name in the literature. So the goal was never a mind with no cigarettes in it. Thoughts will turn up for a while yet. What matters is where they land: \"good, I don't do that anymore\" rather than \"I'm not allowed\". Same thought, opposite meaning.",
    notice:
      'Today, let one smoking thought arrive and do nothing about it. Watch how long it actually lasts.',
    reflect:
      'When a thought about smoking shows up, what does it currently sound like?',
    beliefIds: ['miss-it-forever', 'always-want'],
    triggerIds: ['seeing-smoking', 'habit'],
    sourceKind: 'psych',
    principleRefs: ['A15', 'A16'],
  },
  {
    id: 'the-trap-not-the-person',
    kind: 'booster',
    title: 'A trap, not a character flaw',
    idea: "Carr's picture for it is a pitcher plant: easy to enter, built so that leaving is hard, and no insect ever chose it. Nobody at fifteen decided on thirty years of this. The design did the work — the first ones unpleasant, the hook set quietly, the exit made to look expensive. You were recruited. Which also means there is no defect in you to correct before you can leave.",
    notice:
      'Today, when the old story about failed attempts turns up, notice it is describing how the trap was built, not who you are.',
    reflect:
      'What would you say to a friend caught in something designed to catch them?',
    beliefIds: ['confidence', 'willpower-needed'],
    triggerIds: ['emotional', 'stress'],
    sourceKind: 'carr',
    principleRefs: ['A17', 'A8'],
  },

  // --- Exercises -----------------------------------------------------------
  {
    id: 'catch-the-relaxing-one',
    kind: 'exercise',
    title: 'Catch it: this would relax me',
    notice: "You're tense, and a cigarette arrives as the obvious answer.",
    reflect:
      'Was the tension there before the craving, or did it arrive with it?',
    idea: 'Most of the time the sequence runs backwards from how it feels: the tension is withdrawal, the cigarette removes the tension it installed, and the loop gets filed under relaxation. A non-smoker sitting in your chair, in your day, with your workload, is not quietly wanting anything. That gap between you and them is the addiction, not the day.',
    beliefIds: ['relaxation', 'stress-relief'],
    triggerIds: ['stress', 'habit'],
    sourceKind: 'carr',
    principleRefs: ['A4', 'A3'],
  },
  {
    id: 'catch-the-coffee',
    kind: 'exercise',
    title: 'Catch it: the coffee needs one',
    notice: 'First sip lands, and something feels unfinished.',
    reflect:
      'What was the coffee doing for you before smoking attached itself to it?',
    idea: "The cigarette didn't build this ritual. It moved in and took the credit. Warm cup, first pause of the day, ten minutes nobody wants anything from you — all of that survives intact. So don't move the ritual and don't drink it somewhere else. Keep it exactly as it is and notice, while it's happening, that it is already whole.",
    beliefIds: ['coffee-ritual', 'break-permission'],
    triggerIds: ['coffee', 'habit'],
    sourceKind: 'carr',
    principleRefs: ['A12', 'C1'],
  },
  {
    id: 'catch-the-drink',
    kind: 'exercise',
    title: 'Catch it: drinks are different now',
    notice: 'Second drink, someone steps outside, and you feel left behind.',
    reflect:
      'Would that person swap places with you, honestly, if they could do it without losing face?',
    idea: "The pull in that moment is usually envy pointed at the wrong person. Nearly every smoker out there wishes they had never started; they aren't enjoying a treat, they're topping up so the evening stays normal. Keep your seat, keep your drink, and let the night go on being the thing you came out for.",
    beliefIds: ['alcohol-pairing', 'social-ease'],
    triggerIds: ['alcohol', 'social'],
    sourceKind: 'carr',
    principleRefs: ['A12', 'A11'],
  },
  {
    id: 'catch-the-after-meal-one',
    kind: 'exercise',
    title: 'Catch it: the one after the meal',
    notice: 'Plate cleared, and the meal seems to be missing its last step.',
    reflect:
      'How long had it been since the previous cigarette when that feeling arrived?',
    idea: "The after-meal cigarette usually follows the longest smoke-free stretch of the evening, which is precisely when the dip is deepest — that is why it feels like the best one of the day. Stay at the table two minutes past the old script and the sense of completion turns up anyway. It was coming from the meal.",
    beliefIds: ['meal-completion', 'reward'],
    triggerIds: ['after-food', 'habit'],
    sourceKind: 'carr',
    principleRefs: ['A12', 'A3'],
  },
  {
    id: 'catch-the-nothing-to-do',
    kind: 'exercise',
    title: 'Catch it: nothing to do',
    notice:
      'A gap opens — a queue, a waiting room, ten minutes between things — and smoking presents itself as the answer to it.',
    reflect:
      'Which part of that break were you actually after: the pause, the air, the being elsewhere, or the smoke?',
    idea: 'Standing outside holding a small burning object is not, on inspection, interesting. Boredom is a risky moment for a different reason: it removes the distractions that were covering the faint background signal, so the signal gets the floor. And the break itself was always the good part. Keep the loop — the ten minutes, the doorway, the coming back — and drop only the cigarette out of it.',
    beliefIds: ['boredom-relief', 'break-permission'],
    triggerIds: ['boredom', 'habit'],
    sourceKind: 'psych',
    principleRefs: ['A6', 'C2'],
  },
  {
    id: 'catch-the-earned-one',
    kind: 'exercise',
    title: 'Catch it: I have earned this',
    notice:
      'Something went well, or something was hard, and a cigarette turns up as the payment.',
    reflect:
      "What is the reward, exactly — and would you want it if you weren't already hooked?",
    idea: 'A reward should add something. This one ends a discomfort your last cigarette arranged and books the next round of it. Notice what a strange prize that is: you did well, so here is a short return to normal, plus a bill. And there is no loss here to compensate. Nothing is being taken from you, so nothing needs paying back.',
    beliefIds: ['reward', 'deprivation'],
    triggerIds: ['habit', 'emotional'],
    sourceKind: 'carr',
    principleRefs: ['A3', 'A7'],
  },
  {
    id: 'catch-just-one',
    kind: 'exercise',
    title: "Catch it: just one wouldn't matter",
    notice:
      'Late, warm, among smokers — and one seems like a small, self-contained decision.',
    reflect:
      "Is the real question 'one cigarette', or 'all of them again, from tomorrow'?",
    idea: "'Just one' never announces what it actually is: a vote to go back to every day, all day, for years. Almost nobody has one and stops there — the wiring is still warm, and a single puff is the strongest predictor of a full return. Ask the real question and the answer gets easy. And if one already happened, that was a hard moment, not a verdict. Log it and carry on.",
    beliefIds: ['just-one'],
    triggerIds: ['alcohol', 'social', 'emotional'],
    sourceKind: 'psych',
    principleRefs: ['A10', 'C7'],
  },
  {
    id: 'catch-the-highlight-reel',
    kind: 'exercise',
    title: 'Catch it: I miss it',
    notice:
      'A memory turns up warm and well edited: a particular balcony, a particular evening, the smoke looking good in the light.',
    reflect:
      'What happened in the twenty minutes after that cigarette, and in the twenty before it?',
    idea: "Memory keeps the highlights and quietly bins the rest: the taste at seven in the morning, the cough, the standing in the rain, the checking you had enough for tomorrow. Don't argue with the good memory — it's real. Just play the whole reel, both ends of it. Nostalgia only works on the edit.",
    beliefIds: ['miss-it-forever', 'identity'],
    triggerIds: ['seeing-smoking', 'emotional'],
    sourceKind: 'psych',
    principleRefs: ['A16', 'A15'],
  },
  {
    id: 'catch-the-duller-life',
    kind: 'exercise',
    title: 'Catch it: life will be flatter',
    notice:
      'You picture next year — same job, same friends, no cigarettes — and it looks slightly grey.',
    reflect:
      'Which of the things you love actually needed the cigarette, and which just had one standing next to them?',
    idea: "That grey picture is drawn by the thing you're leaving, and it has an interest in the result. Meals, drinks, company, music, the end of a long day: none of them were produced by smoking. They were interrupted by it, at intervals, for years. What's on the other side isn't this life minus something. It's this life without a small crisis scheduled through it.",
    beliefIds: ['life-worse', 'deprivation'],
    triggerIds: ['emotional', 'social'],
    sourceKind: 'carr',
    principleRefs: ['A7', 'A11', 'A3'],
  },
  {
    id: 'catch-the-not-in-you',
    kind: 'exercise',
    title: "Catch it: I haven't got it in me",
    notice: 'An old failed attempt surfaces as evidence about you.',
    reflect:
      'Were you trying to want it less, or trying to want it exactly as much and say no every time?',
    idea: "White-knuckling means wanting a cigarette forever and talking yourself out of it several times a day. That is an unstable arrangement, and losing it says nothing about the person doing it. The alternative isn't a better-equipped you, it's a smaller wanting: change what you believe a cigarette does for you and there is nothing left to argue with. That shift in expectation is what predicts stopping — not a trait you were issued or weren't.",
    beliefIds: ['willpower-needed', 'confidence'],
    triggerIds: ['emotional', 'stress'],
    sourceKind: 'psych',
    principleRefs: ['A8', 'A17'],
  },
];
