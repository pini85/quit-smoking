// Today screen: hero, stats, wins, cards.
export const home = {
  hero: {
    readyToStart: 'Ready to start',
    freedomStartsIn: 'Freedom starts in',
    smokeFree: 'smoke-free',
    preciseHint: 'Tap to switch between rounded and precise time.',
    sinceQuit: '{duration} since you quit — still yours',
    next: 'Next: {title} — {eta}',
  },
  stats: {
    notSmoked: 'not smoked',
    saved: 'saved',
    lifeRegained: 'life regained',
  },
  methodology: {
    title: 'How these numbers work',
    cigsHeading: 'Cigarettes not smoked',
    cigsBody:
      "You told us you smoked {perDay} a day. We multiply that by how long you've been smoke-free and round down — so far, {count}.",
    moneyHeading: 'Money saved',
    moneyBody:
      "{perDay} cigarettes a day out of packs of {perPack} at {packPrice} a pack works out at {saved} so far. It assumes your old rate stayed constant and that prices haven't changed.",
    lifeHeading: 'Life regained',
    lifeBody:
      "Research from UCL (2024) estimates each cigarette costs roughly 17–22 minutes of life. We use {minutes} minutes, near the middle of that range, multiplied by the cigarettes you haven't smoked. It's a population average, not a promise about your particular body.",
    estimatesNote: 'These are estimates, honestly labeled.',
  },
  wins: {
    invite:
      'When a craving hits, the button below is the move. It takes about 3 minutes. Freedom is for the time in between.',
    countLineOne: '{passed} of 1 craving passed without smoking',
    countLineOther: '{passed} of {resolved} cravings passed without smoking',
    untagged: 'untagged',
    outcomes: {
      passed: 'Passed',
      muchWeaker: 'Much weaker',
      stillThere: 'Outlasted',
      smoked: 'Logged honestly',
    },
  },
  prep: {
    title: 'While you wait',
    tips: [
      'Halve your coffee — quitting doubles caffeine’s kick',
      'Bin the ashtrays and lighters tonight',
      'Tell one person your quit moment',
    ],
  },
  bodyNow: {
    title: 'What’s changing in your body right now',
    startingSoon: 'Starting soon',
    progressLabel: 'Progress through this change',
  },
  discovery: {
    kicker: 'Did you know?',
    dismiss: "Dismiss today's discovery",
  },
  freedomCard: {
    kicker: 'Freedom',
    brainLink: 'My brain is convincing me…',
    booster: 'Today’s booster: {title}',
  },
  slip: {
    within24:
      'The day after a slip is when most quits are decided. One craving at a time — your button is right below.',
    within96: 'Two days past a slip is the highest-risk window closing. Keep going.',
    dismiss: 'Dismiss check-in',
  },
};
