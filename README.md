# cloudtak-plugin-measure
<img width="2316" height="1267" alt="image" src="https://github.com/user-attachments/assets/f8825094-cd24-4606-8726-68378c602bed" />

A CloudTAK plugin to measure distances between points or along a line string and to generate a
terrain profile without creating a CoT object.

See [`docs/PLAN.md`](docs/PLAN.md) for the full architecture and phased plan.

## Status

Phase 0 spike — the draw surface, left-control ruler toggle, results pane, distance/bearing
maths and snapping bridge are in place and pass lint + typecheck. **Runtime validation in the
browser is still outstanding.**

## Install

Plugins are bundled by Vite from `~/CloudTAK/api/web`, not built here.

```sh
ln -sfn ~/dev/cloudtak-plugin-measure ~/CloudTAK/api/web/plugins/measure
cd ~/CloudTAK/api/web && npm run serve   # or: npm run build
```

`api/web/plugins/` is gitignored, so the symlink never shows up in CloudTAK's git status.

The ruler is not a bottom-bar plugin. `PluginPane` is a 50px strip that opens for every
registered item, and the button is teleported out of that slot. `enable()` only
`remove`s a stale `measure` key, then mounts the toggle on a hidden host.

This behavior lives in this repo (`index.ts`, `lib/toggle-host.ts`, `lib/mount-toggle.ts`).
A CloudTAK core update does not overwrite it. It reaches a VPS only when the image is
rebuilt from a commit that contains it — either via `WEB_PLUGINS` or from a plugin folder
already inside the CloudTAK tree (that folder is used instead of a fresh clone). After
deploy, hard-refresh. The image keeps plugin source under `/home/etl/app/plugins/`.
`WEB_PLUGINS` names the folder after the git repo (`cloudtak-plugin-measure`). A folder
that already exists is not re-cloned, so a local `plugins/measure` copy stays until you
replace it. Confirm the copy that was built has no `bottomBar.add`:

```sh
docker exec <cloudtak> sh -c 'grep -n "bottomBar.add" \
  /home/etl/app/plugins/measure/index.ts \
  /home/etl/app/plugins/cloudtak-plugin-measure/index.ts'
```

That grep should print nothing. In Default mode the map has a `.measure-toggle-shell` ruler
under the left controls and no empty `.plugin-pane` from this plugin. If a core update
conflicts with a local copy of the plugin, keep this repo's `attachMeasureChrome` path and
do not restore `bottomBar.add`.

## Layout

| Path | Purpose |
|---|---|
| `index.ts` | Plugin entry — `install`/`enable`/`disable` lifecycle |
| `lib/measure-draw.ts` | Plugin-owned TerraDraw surface; distance + bearing maths |
| `lib/core-bridge.ts` | Every reach into CloudTAK core internals, guarded and in one place |
| `lib/state.ts` | Module-scoped shared state between the toggle and the pane |
| `lib/units.ts` | Distance formatting, mirroring core's `LineLength.vue` |
| `components/MeasureToggle.vue` | Ruler button, mounted by the plugin and teleported under the left map controls |
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

## Runtime checklist

Confirmed working locally:

1. ✅ Ruler button appears, anchored under the left-margin map controls stack.
2. ✅ Clicking it opens the Measure pane and lets you place vertices.
3. ✅ Total distance, per-segment length and bearing update live.
4. ✅ Opening core Drawing Tools closes the ruler; opening the ruler cancels a core draw.
5. ✅ `db.feature` count unchanged after measuring — no CoT, nothing to Data Sync.
6. ✅ `measure-*` sources exist while active and are gone after closing; core's `td-*` untouched.

## Keyboard

| Key | Action |
|---|---|
| `Enter` | Finish the line (park it until Clear or Save) |
| `Esc` | Finish a valid line (≥2 points); clear a short draft; dismiss the “new measurement?” prompt when already finished |
| `Backspace` / `Delete` | Remove the last point |
| `Cmd`/`Ctrl` + `Z` | Undo |
| `Cmd`/`Ctrl` + `Shift` + `Z` | Redo |

`Enter` is terra-draw's own `finish` keyEvent, pinned explicitly in `measure-draw.ts` so an
upstream default change can't move it. Esc is handled by the plugin so it parks a valid line
instead of terra-draw's default cancel/`cleanUp` wipe. The rest are window-level listeners, live
only while measuring, and suppressed while focus is in a form field (`isTypingTarget`).

Undo uses terra-draw's undo stack, so a "step" is whatever it recorded — normally one vertex,
but in route-snap mode one click can append a whole routed run, which undo reverses as a unit.

**Undo/redo is opt-in in terra-draw.** The `TerraDraw` constructor must be given an `undoRedo`
option; without it no `undoRedoCoordinator` is built and `undo()` / `canUndo()` silently return
false — no error, the button just stays disabled forever. Both levels are required and they
cover mutually exclusive states:

| Level | Active when |
|---|---|
| `TerraDrawModeUndoRedo` | `state === 'drawing'` — mid-line |
| `TerraDrawSessionUndoRedo` | NOT drawing — after finish, while parked in static |

`keyboardShortcuts` is deliberately not passed; the plugin binds its own so the typing-target
guard applies.

## Still to verify

7. ✅ Snap layer picker lists the snapping basemaps, and selecting one routes along the network.
8. ✅ Snapping zoom clamp logs and bounds the tile-cover on a basemap with a bogus `maxzoom`.
9. ✅ Closing the ruler leaves core's Drawing Tools back on "No Snapping".
10. ⬜ Keyboard shortcuts, including Backspace inside the snap-layer picker not deleting a point.
