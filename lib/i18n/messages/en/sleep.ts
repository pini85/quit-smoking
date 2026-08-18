export const sleep = {
  pageTitle: 'Snore Monitor',
  disclaimer:
    'Not a medical device. This cannot detect sleep apnea or diagnose anything — it only compares your nights to your own baseline.',
  webDevNote: 'Dev recorder: keep this tab open — closing it or switching tabs stops the recording.',
  unavailable: {
    title: 'Snore monitoring isn’t available here',
    body: 'Snore monitoring needs the Unsmoke Android app — it isn’t available in this browser or on this device.',
  },
  preSleep: {
    title: 'Tonight',
    tips: {
      placement:
        'Keep your phone in the same spot on your nightstand every night — a consistent position makes nights comparable.',
      mic: 'Make sure the microphone isn’t covered by a case, pillow, or blanket.',
      charger: 'Plug in your charger — monitoring runs all night and uses the microphone continuously.',
    },
    keepClips: {
      title: 'Keep audio clips',
      on: 'Short clips of your loudest snore events are kept on this device so you can listen back.',
      off: 'No audio clips are kept — only the numbers.',
      privacyNote:
        'Clips never leave this device, and the full night’s recording is always deleted once analysis finishes — kept clips or not.',
      toggleOn: 'On',
      toggleOff: 'Off',
    },
    start: 'Start monitoring',
    starting: 'Starting…',
    permissionDenied: {
      title: 'Microphone access needed',
      body: 'Snore monitoring needs microphone access. Enable it for Unsmoke in your phone’s Settings → Apps → Unsmoke → Permissions, then try again.',
    },
    deleteClipsSheet: {
      title: 'Delete existing clips?',
      body: 'Turning this off stops keeping new clips. You can also delete the clips already saved from past nights.',
      deleteExisting: 'Delete existing clips',
      keepExisting: 'Keep existing clips',
    },
  },
  active: {
    startedAt: 'Started {time}',
    elapsed: 'Elapsed',
    lockPhoneNote: 'You can lock your phone or use other apps. Android will continue monitoring.',
    stop: 'Stop monitoring',
    stopping: 'Stopping…',
  },
  analyzing: {
    title: 'Analyzing last night…',
    note: 'This usually only takes a moment.',
    retry: 'Retry analysis',
    retrying: 'Retrying…',
  },
  results: {
    title: 'Last night',
    duration: 'Monitored',
    snoreDuration: 'Probable snoring',
    eventsPerHour: 'Snore events/hr',
    avgIntensity: 'Average intensity',
    burden: 'Snore burden',
    interruptedNote: 'Recording ended early — results may be incomplete.',
    failedNote: 'Couldn’t analyze last night’s recording — no usable audio survived.',
    intensityBands: {
      quiet: 'Quiet',
      moderate: 'Moderate',
      loud: 'Loud',
      veryLoud: 'Very loud',
    },
    vsBaselineDown: '↓ {percent}% vs. your baseline',
    vsBaselineUp: '↑ {percent}% vs. your baseline',
    vsBaselineFlat: '≈ vs. your baseline',
  },
  trends: {
    title: 'Snore trends',
    empty:
      'After {nights} nights of monitoring, you’ll see how your snoring is trending — no guessing, just your own data.',
    metricToggle: {
      label: 'Chart metric',
      burden: 'Burden',
      eventsPerHour: 'Events/hr',
    },
    ariaBurden: 'Nightly snore burden score, trending over time',
    ariaEventsPerHour: 'Nightly snore events per hour, trending over time',
    metricNames: {
      snoreDurationMs: 'Snoring duration',
      eventsPerHour: 'Snore events per hour',
      avgIntensity: 'Average intensity',
      snoreBurden: 'Snore burden',
    },
    delta: {
      decreasedSincePreQuit: '{metric} is down {percent}% since you stopped smoking.',
      increasedSincePreQuit: '{metric} is up {percent}% since you stopped smoking.',
      unchangedSincePreQuit: '{metric} is about the same as before you stopped smoking.',
      decreasedSinceFirstNights: '{metric} is down {percent}% since your first nights.',
      increasedSinceFirstNights: '{metric} is up {percent}% since your first nights.',
      unchangedSinceFirstNights: '{metric} is about the same as your first nights.',
    },
  },
  clips: {
    title: 'Snore clips',
    delete: 'Delete clip',
  },
  history: {
    title: 'Sleep history',
    failed: 'Analysis failed',
    notAnalyzed: 'Not analyzed yet',
    unfinished: 'Recording never finished',
    interrupted: 'Interrupted',
    delete: 'Delete this night',
    deleteAll: 'Delete all snoring data',
    deleteNightSheet: {
      title: 'Delete this night?',
      body: 'This removes the recording and its stats permanently.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },
    deleteAllSheet: {
      title: 'Delete all snoring data?',
      body: 'This removes every night’s recording, stats, and clips permanently. Your quit-smoking data is not affected.',
      confirm: 'Delete all',
      cancel: 'Cancel',
    },
  },
  progressEntry: {
    title: 'Snoring',
    invite: 'Start monitoring your snoring overnight to see how it changes as you stay smoke-free.',
    cta: 'Open Snore Monitor',
    lastNightLine: 'Last night: burden {burden}',
  },
};
