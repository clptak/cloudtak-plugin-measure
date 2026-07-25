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
import { useMapStore } from '../../../src/stores/map.ts';

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
    finish?: () => Promise<void>;
};

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
            await draw.updateGraph();
        }

        return true;
    } catch (err) {
        console.warn('[measure] failed to select snapping layer', err);
        return false;
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
        await draw.updateGraph({ expand: true });
    } catch (err) {
        console.warn('[measure] failed to expand routing graph', err);
    }
}
