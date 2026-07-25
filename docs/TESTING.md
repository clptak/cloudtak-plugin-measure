# Testing

## Unit tests — run here, standalone

```sh
cd ~/dev/cloudtak-plugin-measure
npm install     # vitest only; no runtime deps
npm test
```

43 tests covering the three dependency-free modules:

| Module | Covers |
|---|---|
| `lib/geometry.ts` | haversine distance, true bearing, per-segment measurement, marker-snap nearest-within, zoom-scaled snap threshold |
| `lib/units.ts` | distance conversion factors, formatting, bearing padding, unit fallback |
| `lib/profile-stats.ts` | min/max/gain/loss, null-sample handling, negative elevations |

### Why only those three

Everything else (`measure-draw.ts`, `core-bridge.ts`, the components) imports CloudTAK core or
terra-draw, which only resolve through `api/web`'s Vite config. The measurement maths was
deliberately extracted into dependency-free modules so it can be tested without that machinery.

`lib/geometry.ts` reimplements `@turf/distance` rather than importing it — same haversine
formula, same 6371.0088 km earth radius from `@turf/helpers`. Two tests pin that constant, so
if it ever drifts from what core's `LineLength.vue` computes via `@turf/length`, they fail.

### Notes on two assertions that look wrong

- `trueBearing([0,0],[0,1],...)` "due east" at latitude 1 is **89.991°, not 90°**. That is
  correct: it is the *initial* great-circle bearing, and the great circle bows poleward. If this
  ever reads exactly 90, a rhumb-line bearing has crept in.
- `convertDistance(1, 'mile')` is **0.62, not 0.621371** — core's `LineLength.vue` rounds to two
  decimals, and we match it deliberately.

## Lint + typecheck — needs a real directory

**`vue-tsc` and `eslint` silently skip symlinked plugin directories.** `npm run lint` and
`npm run check` in `api/web` have never checked this plugin, or any other `~/dev` plugin.

To actually verify, copy it in as a real directory:

```sh
cd ~/CloudTAK/api/web
mkdir -p plugins/_measurecheck
tar --exclude=.git --exclude=node_modules --exclude=docs -cf - \
    -C ~/dev/cloudtak-plugin-measure . | tar -xf - -C plugins/_measurecheck

npx eslint --config eslint.config.js ./plugins/_measurecheck/
npx vue-tsc --noEmit

rm -rf plugins/_measurecheck
```

Both must be clean. `plugins/` is gitignored in `api/web`, so this never shows up in CloudTAK's
git status.

Excluding `node_modules` from that copy matters: without it the copy is enormous, and the
plugin's own vitest would be resolved instead of CloudTAK's.

## A landmine worth remembering

`vitest.config.ts` deliberately exports a **plain object** instead of using `defineConfig` from
`vitest/config`. Importing vitest's types drags this plugin's vitest version into any
TypeScript program that includes the file — and during the verification step above, that
conflicts with CloudTAK's vitest and fails `vue-tsc` on `api/web/vite.config.ts`, a file this
plugin has nothing to do with. `defineConfig` is an identity function, so the plain object costs
nothing.

## Not covered by any automated test

- The teleported button's anchoring to `.cloudtak-ctrl-group`
- Mutual exclusion with core Drawing Tools
- The click-swallowing that stops core opening a radial menu mid-measurement
- The snapping-zoom clamp and snapping-state restore
- Anything touching the tiles service

These need the runtime checklist in `README.md`.
