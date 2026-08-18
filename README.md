# Unsmoke

A private, local-first quit-smoking companion. It gives you seven things: a
live count of how long you have been smoke-free, a three-minute craving flow
you can reach from any screen, an evidence-linked map of what your body is
recovering, proof drawn from your own logged cravings, badges that unlock only
on what you have actually done, a place to keep the reasons you started, and —
in the Android app — overnight snore monitoring that compares your nights to
your own earlier ones.

Nothing in it is guesswork dressed up as a fact. Every health milestone carries
its evidence level and its source, every derived number can be tapped to see
exactly how it was calculated, and a craving that ended in a cigarette is
recorded in the same neutral voice as one that did not. Snore monitoring is
held to the same standard: it is not a medical device, it cannot detect sleep
apnea or diagnose anything, and it only ever compares your nights to your own
baseline.

## Privacy

There is no account, no server, and no analytics. Every byte the app holds —
your profile, your cravings, your reasons, your nightly snore stats — lives in
IndexedDB on your own device and is never transmitted anywhere. The app has no
network calls at runtime beyond loading its own static assets, and it works
fully offline once installed. The export file you can produce from the You
screen is your only backup; if you clear the browser's storage or lose the
device, the data is gone, because there is nowhere else it exists.

Snore monitoring records real audio, so it is worth being precise about it:

- The overnight recording is written to Android app-private storage
  (`files/snore/`), which no other app can read.
- It is analyzed entirely on-device — the signal processing runs in the app's
  own Kotlin code, not in a service somewhere.
- The full night's recording is deleted as soon as analysis finishes, and the
  nightly numbers are all that is kept. A night whose audio turns out to be
  unanalyzable is deleted too.
- Short clips of the loudest snore events are kept only if you turn that on,
  only on this device, and you can delete them (or every night's data) from the
  Sleep screen at any time.
- Nothing leaves the device. The release build does not declare the `INTERNET`
  permission at all, so there is no network path out for the audio or anything
  derived from it. Snore files are also explicitly excluded from Android's
  cloud backup and from device-to-device transfer.

## Development

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm dev        # dev server on http://localhost:3000
pnpm test       # vitest — domain and persistence suites
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm build      # next build (static export to out/) + service worker generation
```

`pnpm build` runs `next build` followed by `scripts/generate-sw.mjs`, which
rewrites `lib/service-worker.js` into `out/sw.js` with a real precache manifest
and a content-derived cache version. Running `next build` on its own produces
an `out/` without a working service worker, so always build through the script.

To preview the production output the way it is actually served:

```bash
pnpm build && python3 -m http.server 8123 -d out
```

### Android

Snore monitoring is the one feature that only exists in the Android app — it
needs a foreground service and a real microphone, so in a browser it either
falls back to a dev-only fake recorder (in `pnpm dev`) or reports itself as
unavailable.

```bash
pnpm build:android                      # pnpm build, then cap sync android
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/
cd android && ./gradlew testDebugUnitTest lintDebug
```

This needs a full Android toolchain (JDK 21+ and an Android SDK with the
platform in `android/variables.gradle`); everything above is a no-op without
one, and none of it is required for the web build or `pnpm test`.

`docs/android-snore-verification.md` is the manual on-device checklist —
foreground service, process death, reboot, an actual overnight run. None of
that is reachable from unit tests, so work through it on a real device before
shipping changes to the recorder.

## Deployment

Static export, no runtime. `netlify.toml` builds with `pnpm build`, publishes
`out/`, serves `/sw.js` with `no-cache` so updates are picked up promptly, and
serves `/_next/static/*` immutably. Any static host with those two cache rules
will do.
