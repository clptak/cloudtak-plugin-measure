/**
 * Guarded bridge to CloudTAK core internals.
 *
 * Everything in this file reaches into the core map store's DrawTool. Those
 * fields are public in the current source (`api/web/src/stores/modules/draw.ts`
 * — `public route`, `public get mode`), but they are still *core* surface that
 * upstream can rename. Keeping every access in this one file means a breaking
 * rebase is a one-file fix, and each accessor degrades instead of throwing.
 */

import type { Pinia } from 'pinia';
import type { Position } from 'geojson';
import { v4 as uuid } from 'uuid';
import { useMapStore } from '../../../src/stores/map.ts';
import Config from '../../../src/base/config.ts';

/** Mirrors DrawToolMode.STATIC in api/web/src/stores/modules/draw.ts:36 */
export const CORE_STATIC_MODE = 'static';

/** Sentinel used by core's snapping layer picker (draw.ts:107) */
export const NO_SNAPPING = 'No Snapping';

type CoreDrawTool = {
    mode?: string;
    route?: {
        graph?: unknown;
        layer?: string;
        zoom?: number;
    };
    snappingOptions?: string[];
    snappingLayer?: string;
    updateGraph?: (opts?: { expand?: boolean }) => Promise<void>;
    populateSnappingLayers?: () => Promise<void>;
    finish?: () => Promise<void>;
};

/**
 * Id of the raster-dem basemap configured as terrain (`map::terrain`), or
 * undefined when none is set. Used by the elevation profile API; does not
 * require MapLibre 3D terrain to be enabled. Mirrors `stores/map.ts:479-482`.
 */
export async function terrainBasemapId(): Promise<number | undefined> {
    try {
        const cfg = await Config.list(['map::terrain'], {
            defaults: { 'map::terrain': null }
        });
        const value = cfg['map::terrain'];
        return value ? Number(value) : undefined;
    } catch (err) {
        console.warn('[measure] failed to read terrain basemap config', err);
        return undefined;
    }
}

function drawTool(pinia: Pinia): CoreDrawTool | undefined {
    try {
        const mapStore = useMapStore(pinia);
        return (mapStore as unknown as { draw?: CoreDrawTool }).draw;
    } catch {
        return undefined;
    }
}

/**
 * Is the core Drawing Tools surface currently active?
 *
 * Reads `DrawTool.mode`, which is a `ref` behind a getter (draw.ts:55/68), so
 * this is reactive and safe to call inside a Vue `watch`/`computed`.
 *
 * Returns false if the field is missing — a missing field must never make the
 * ruler think core drawing is permanently active.
 */
export function isCoreDrawActive(pinia: Pinia): boolean {
    const draw = drawTool(pinia);
    if (!draw || typeof draw.mode !== 'string') return false;
    return draw.mode !== CORE_STATIC_MODE;
}

/**
 * Ask core to finish/cancel whatever it is drawing.
 * Best-effort: used before the ruler takes over the map.
 */
export async function cancelCoreDraw(pinia: Pinia): Promise<void> {
    const draw = drawTool(pinia);
    if (!draw || typeof draw.finish !== 'function') return;
    try {
        await draw.finish();
    } catch (err) {
        console.warn('[measure] failed to cancel core draw', err);
    }
}

/**
 * The shared routing graph core builds from vector-tile line networks
 * (draw.ts:222 `new Routing(...)`, stored at `draw.route.graph`).
 *
 * Returned as `unknown` deliberately — the caller passes it straight into
 * TerraDrawRouteSnapMode's `routing` option and never introspects it.
 * Returns undefined when snapping isn't available, which callers must treat
 * as "straight-line only".
 */
export function coreRoutingGraph(pinia: Pinia): unknown | undefined {
    const draw = drawTool(pinia);
    const graph = draw?.route?.graph;
    if (!graph || typeof graph !== 'object') return undefined;
    return graph;
}

/**
 * Ask core to discover which basemaps are snapping-capable.
 *
 * This populates BOTH `draw.snappingOptions` (the picker list) and
 * `draw.route.definitions` (the name → tile-URL map that `updateGraph()` needs
 * at draw.ts:568). Without it, `updateGraph()` throws 'No definition found for
 * layer' inside a per-tile promise, which core swallows into `console.error` —
 * so snapping silently does nothing.
 *
 * Core only ever calls this from `DrawOverlay.vue:416/422`, i.e. when its own
 * Drawing Tools overlay opens. The ruler never opens that overlay, so it must
 * call it itself.
 */
export async function populateSnappingLayers(pinia: Pinia): Promise<void> {
    const draw = drawTool(pinia);
    if (!draw || typeof draw.populateSnappingLayers !== 'function') return;
    try {
        await draw.populateSnappingLayers();
    } catch (err) {
        console.warn('[measure] failed to populate snapping layers', err);
    }
}

/** Snapping layer names core has discovered, including the 'No Snapping' sentinel. */
export function snappingOptions(pinia: Pinia): string[] {
    const draw = drawTool(pinia);
    const options = draw?.snappingOptions;
    if (!Array.isArray(options) || !options.length) return [NO_SNAPPING];
    return options;
}

/** Currently selected core snapping layer. */
export function snappingLayer(pinia: Pinia): string {
    const draw = drawTool(pinia);
    return typeof draw?.snappingLayer === 'string' ? draw.snappingLayer : NO_SNAPPING;
}

/**
 * Hard ceiling on the zoom used to tile-cover the viewport for the routing
 * graph. See `issue-snapping-runaway-requests.md`: a snapping basemap with an
 * unset `maxzoom` is defaulted to 22 by core (`draw.ts:521`), and
 * `updateGraph()` then tile-covers the whole viewport at that zoom — millions
 * of tiles, each a 404 that is never negatively cached and so re-requested on
 * every `moveend`.
 */
const MAX_GRAPH_ZOOM = 16;

/** How far above the current map zoom we are willing to tile-cover */
const GRAPH_ZOOM_HEADROOM = 4;

/**
 * Clamp `route.zoom` so a misconfigured basemap can't flood the tiles service.
 *
 * Chosen so a correctly-configured layer is unaffected: at map z11 with a
 * truthful `maxzoom: 14`, the clamp is `min(14, 15, 16) = 14` — identical to
 * core. With a bogus `maxzoom: 22` it becomes 15 instead of 22.
 */
function clampGraphZoom(pinia: Pinia): void {
    const draw = drawTool(pinia);
    if (!draw?.route || typeof draw.route.zoom !== 'number') return;

    try {
        const mapStore = useMapStore(pinia);
        const mapZoom = mapStore.map.getZoom();

        const clamped = Math.min(
            draw.route.zoom,
            Math.ceil(mapZoom) + GRAPH_ZOOM_HEADROOM,
            MAX_GRAPH_ZOOM
        );

        if (clamped < draw.route.zoom) {
            console.warn(
                `[measure] clamping snapping graph zoom ${draw.route.zoom} -> ${clamped} `
                + '(see issue-snapping-runaway-requests.md)'
            );
            draw.route.zoom = clamped;
        }
    } catch {
        // If we can't read the map zoom, leave core's value alone
    }
}

/**
 * Select a snapping layer and force core to (re)build the routing graph for the
 * current viewport. Resolves false when snapping is unavailable.
 */
export async function selectSnappingLayer(pinia: Pinia, layer: string): Promise<boolean> {
    const draw = drawTool(pinia);
    if (!draw) return false;

    try {
        if (typeof draw.snappingLayer === 'string') {
            draw.snappingLayer = layer;
        } else if (draw.route) {
            draw.route.layer = layer;
        } else {
            return false;
        }

        if (layer !== NO_SNAPPING && typeof draw.updateGraph === 'function') {
            // The setter above assigns route.zoom = def.maxzoom; clamp before
            // any tile-cover happens.
            clampGraphZoom(pinia);
            await draw.updateGraph();
        }

        return true;
    } catch (err) {
        console.warn('[measure] failed to select snapping layer', err);
        return false;
    }
}

/**
 * Put core's snapping state back the way we found it.
 *
 * The ruler drives `draw.snappingLayer`, which is the same field core's
 * DrawOverlay dropdown binds to (`DrawOverlay.vue:153/206`). Without this,
 * closing the ruler leaves core pre-set to our layer, so the next time the user
 * opens Drawing Tools in LineString mode core immediately flips into snapping
 * mode with a layer they never chose.
 */
export async function resetSnappingLayer(pinia: Pinia): Promise<void> {
    const draw = drawTool(pinia);
    if (!draw) return;
    if (snappingLayer(pinia) === NO_SNAPPING) return;

    try {
        if (typeof draw.snappingLayer === 'string') {
            draw.snappingLayer = NO_SNAPPING;
        } else if (draw.route) {
            draw.route.layer = NO_SNAPPING;
        }
    } catch (err) {
        console.warn('[measure] failed to reset snapping layer', err);
    }
}

/**
 * Coordinates of CoT features in the current viewport, for snapping a
 * measurement vertex onto an existing marker.
 *
 * Core keeps an equivalent set on `DrawTool.snapping`, but only while core's
 * own draw mode is non-STATIC — it clears the set otherwise (map.ts:1127-1131).
 * The ruler leaves core in STATIC, so we query the worker DB ourselves.
 */
export async function snapPoints(
    pinia: Pinia,
    bounds: [number, number][]
): Promise<Set<[number, number]>> {
    try {
        const mapStore = useMapStore(pinia);
        const worker = (mapStore as unknown as {
            worker?: {
                db?: {
                    snapping?: (bbox: [number, number][]) => Promise<Set<[number, number]>>;
                };
            };
        }).worker;

        if (typeof worker?.db?.snapping === 'function') {
            return await worker.db.snapping(bounds);
        }
    } catch (err) {
        console.warn('[measure] failed to load snap points', err);
    }
    return new Set();
}

/**
 * Persist a measurement as a real CoT LineString — the only path by which this
 * plugin ever writes to the database. Mirrors the feature shape core builds in
 * draw.ts:399-425 and the same `worker.db.add(feat, { authored: true })` call.
 *
 * Returns the new feature id, or undefined if the write wasn't possible.
 */
export async function saveLine(
    pinia: Pinia,
    coordinates: Position[],
    callsign: string
): Promise<string | undefined> {
    if (coordinates.length < 2) return undefined;

    try {
        const mapStore = useMapStore(pinia);
        const store = mapStore as unknown as {
            worker?: {
                db?: {
                    add?: (
                        feat: Record<string, unknown>,
                        opts: { authored: boolean }
                    ) => Promise<unknown>;
                };
            };
            refresh?: () => Promise<void>;
        };

        if (typeof store.worker?.db?.add !== 'function') return undefined;

        const id = uuid();
        const now = new Date();

        await store.worker.db.add({
            id,
            type: 'Feature',
            path: '/',
            properties: {
                id,
                // u-d-f is what core uses for LINESTRING/SNAPPING (draw.ts:423)
                type: 'u-d-f',
                how: 'h-g-i-g-o',
                archived: true,
                callsign,
                time: now.toISOString(),
                start: now.toISOString(),
                stale: new Date(now.getTime() + 3600).toISOString(),
                center: [0, 0],
            },
            geometry: {
                type: 'LineString',
                coordinates: JSON.parse(JSON.stringify(coordinates)),
            },
        }, { authored: true });

        if (typeof store.refresh === 'function') await store.refresh();

        return id;
    } catch (err) {
        console.error('[measure] failed to save measurement as a line', err);
        return undefined;
    }
}

/**
 * Keep the routing graph expanded as the user pans, mirroring the core
 * `moveend` handler at draw.ts:131.
 */
export async function expandGraphForViewport(pinia: Pinia): Promise<void> {
    const draw = drawTool(pinia);
    if (!draw || typeof draw.updateGraph !== 'function') return;
    try {
        // Re-clamp on every pan: zooming out raises the headroom ceiling, and
        // failed tiles are never cached by core, so an unclamped zoom re-floods
        // on each moveend.
        clampGraphZoom(pinia);
        await draw.updateGraph({ expand: true });
    } catch (err) {
        console.warn('[measure] failed to expand routing graph', err);
    }
}
