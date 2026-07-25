# cloudtak-plugin-measure

A CloudTAK plugin to measure distances between points or along a line string and to generate a
terrain profile without creating a CoT object.

See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and phased plan.

## Status

Phase 0 spike — the draw surface, bottom-bar toggle, results pane, distance/bearing maths and
snapping bridge are in place and pass lint + typecheck. **Runtime validation in the browser is
still outstanding.**

## Install

Plugins are bundled by Vite from `~/CloudTAK/api/web`, not built here.

```sh
ln -sfn ~/dev/cloudtak-plugin-measure ~/CloudTAK/api/web/plugins/measure
cd ~/CloudTAK/api/web && npm run serve   # or: npm run build
```

`api/web/plugins/` is gitignored, so the symlink never shows up in CloudTAK's git status.

## Layout

| Path | Purpose |
|---|---|
| `index.ts` | Plugin entry — `install`/`enable`/`disable` lifecycle |
| `lib/measure-draw.ts` | Plugin-owned TerraDraw surface; distance + bearing maths |
| `lib/core-bridge.ts` | Every reach into CloudTAK core internals, guarded and in one place |
| `lib/state.ts` | Module-scoped shared state between the toggle and the pane |
| `lib/units.ts` | Distance formatting, mirroring core's `LineLength.vue` |
| `components/MeasureToggle.vue` | Ruler button, registered via `api.bottomBar.add()` |
| `components/MeasurePane.vue` | Floating results pane |

## Import paths

Imports of CloudTAK core use real-path-relative depth:

```ts
import type { PluginAPI } from '../../plugin.ts';         // from index.ts
import { useMapStore } from '../../../src/stores/map.ts'; // from lib/
```

`api/web/vite.config.js` (the `symlinked-plugin-resolve` plugin) rewrites these for symlinked
`~/dev/cloudtak-*` plugins, and the same depths are what `vue-tsc` resolves against a real
directory — so both the bundler and the typechecker agree.

## Verification

Run from `~/CloudTAK/api/web`:

```sh
npx eslint --config eslint.config.js ./plugins/
npx vue-tsc --noEmit
```

Note that `vue-tsc` and `eslint` **skip symlinked plugin directories**. To actually check this
plugin, copy it into `plugins/` as a real directory first:

```sh
cp -r ~/dev/cloudtak-plugin-measure ~/CloudTAK/api/web/plugins/_measurecheck
# ...run the commands above...
rm -rf ~/CloudTAK/api/web/plugins/_measurecheck
```

## Runtime checklist (not yet done)

1. Ruler button appears under the top map-controls bar, left of the compact menu.
2. Clicking it opens the Measure pane and lets you place vertices.
3. Total distance, per-segment length and bearing update live.
4. Opening core Drawing Tools closes the ruler; opening the ruler cancels a core draw.
5. Selecting a snap layer routes the line along the network.
6. **`db.feature` count is unchanged after measuring, and no CoT reaches the Active Data Sync.**
7. `measure-point` / `measure-linestring` / `measure-polygon` sources exist while active and are
   gone after closing; core's `td-*` layers are untouched.
