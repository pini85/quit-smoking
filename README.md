# Unsmoke

A private, local-first quit-smoking companion. It gives you six things: a live
count of how long you have been smoke-free, a three-minute craving flow you can
reach from any screen, an evidence-linked map of what your body is recovering,
proof drawn from your own logged cravings, badges that unlock only on what you
have actually done, and a place to keep the reasons you started.

Nothing in it is guesswork dressed up as a fact. Every health milestone carries
its evidence level and its source, every derived number can be tapped to see
exactly how it was calculated, and a craving that ended in a cigarette is
recorded in the same neutral voice as one that did not.

## Privacy

There is no account, no server, and no analytics. Every byte the app holds —
your profile, your cravings, your reasons — lives in IndexedDB on your own
device and is never transmitted anywhere. The app has no network calls at
runtime beyond loading its own static assets, and it works fully offline once
installed. The export file you can produce from the You screen is your only
backup; if you clear the browser's storage or lose the device, the data is
gone, because there is nowhere else it exists.

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

## Deployment

Static export, no runtime. `netlify.toml` builds with `pnpm build`, publishes
`out/`, serves `/sw.js` with `no-cache` so updates are picked up promptly, and
serves `/_next/static/*` immutably. Any static host with those two cache rules
will do.
