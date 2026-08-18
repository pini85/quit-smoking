# Finnish translation — native-speaker review checklist

All Finnish text in this app was machine-translated by Claude as part of adding
a language option (English default, Finnish opt-in via the You page or the
welcome wizard's first step). None of it has been reviewed by a native Finnish
speaker. This document tracks what still needs that review, in priority order.

## Why this list exists

The app's tone is deliberately narrow: curious rather than combative, no
deprivation vocabulary ("giving up", "sacrifice"), no exclamation marks, no
willpower-as-virtue framing outside of quoting the belief being dismantled.
The Finnish translations were written to preserve that tone and — for the
medical content — every number, hedge word, and citation exactly as the
English source states it. `tests/domain/i18nContentParity.test.ts` enforces
the mechanical parts of this (ids match, array lengths match for rotation,
a Finnish mirror of the tone/safety scan). What it cannot check is whether the
Finnish actually *reads* naturally, or whether a medical claim's hedging
survived translation with the right register. That's what native review is for.

## Priority 1 — medical content (highest stakes)

- `data/fi/healthMilestones.ts` — 80 entries: title, description, and (where
  present) `honestNote` / the `noTimeline` `phrase`. Every entry carries a
  citation and often a specific statistic. Review should check:
  - Every number/statistic/citation is unchanged from the English source.
  - Hedge words ("roughly", "may", "isn't well established") read with the
    same strength in Finnish, not upgraded to a firmer claim.
  - Clinical terms (cotinine, carboxyhaemoglobin, FEV1, MAO-A/B, etc.) use
    standard Finnish medical terminology, not literal calques.
- `data/fi/achievements.ts` — 28 badge `fact` strings carry withdrawal
  timelines and health-recovery figures (e.g. nicotine receptor
  normalization, white blood cell counts). Same numeric-fidelity check as
  above.

## Priority 2 — tone-sensitive content (psychological/persuasive)

- `data/fi/brainResponses.ts` — 18 beliefs × 2–3 response variants each,
  read in seconds during a live craving. Needs a natural, calm register;
  review whether any line reads stilted or overly literal in a way that
  would undercut the moment.
- `data/fi/freedomLessons.ts` — 19 lessons (9 boosters + 10 exercises),
  longer-form prose. Same tone check, plus: every `reflect` question should
  read as a genuine, answerable question in Finnish, not a translated
  rhetorical fragment.
- `data/fi/beliefs.ts` — 18 belief `label`/`promise` pairs. `promise` is a
  first-person quote in the smoker's own voice (including
  `willpower-needed`'s "tahdonvoimaa" and `deprivation`'s "Luovun jostain")
  — that's intentional, not a tone-doctrine violation; see the file's header
  comment.
- `data/fi/unnamedResponse.ts` — 2 lines, the /brain flow's answer when no
  belief is named.

## Priority 3 — UI chrome and shorter strings

- `lib/i18n/messages/fi/*.ts` — all UI chrome, button labels, empty states,
  toasts, sheet titles. Lower stakes individually, but there are ~300+
  strings across `chrome`, `home`, `craving`, `freedom`, `brain`, `welcome`,
  `you`, `progress`, `health`, `common`. Spot-check for: awkward literal
  translations, incorrect Finnish grammatical case on interpolated values
  (e.g. `{count}` placeholders), and any string that reads like a direct
  English calque rather than natural Finnish phrasing.
- `data/fi/{triggers,categoryMeta,interventions}.ts` — short labels and
  intervention titles/taglines/prompts. Lower risk (short, concrete), but
  still unreviewed.

## Out of scope for this review

- Structural fields (ids, timing, evidenceLevel, sources, principleRefs,
  conditions, durations) are never translated — they're shared between
  locales and don't need review.
- Citation labels (`sources[].label`, e.g. "PubMed", "WHO", "Nature") are
  publisher/study names and are intentionally left in English in both
  locales.

## Process

Until a native speaker completes this review, the You-page language picker
shows a disclaimer whenever Finnish is selected (see
`components/you/LanguageSection.tsx`, `m.you.language.medicalNote`). Once a
section above has been reviewed and corrected, remove it from this list (or
mark it done) and consider whether the disclaimer can be narrowed or removed
entirely once all of Priority 1 and 2 are clear.
