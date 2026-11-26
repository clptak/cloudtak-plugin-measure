/**
 * Module-scoped plugin state.
 *
 * Plugins share one Vite bundle and one runtime, so a module singleton is the
 * simplest way for the bottom-bar toggle and the floating results pane to talk
 * to the same MeasureDraw instance without prop plumbing through the core
 * component tree.
 */

import { ref, shallowRef } from 'vue';
import type { Pinia } from 'pinia';
import type MeasureDraw from './measure-draw.ts';
import {
    isCoreDrawActive,
    populateSnappingLayers,
    resetSnappingLayer,
    selectSnappingLayer,
    NO_SNAPPING,
} from './core-bridge.ts';
import { normalizeDistanceUnit } from './units.ts';
import type { DistanceUnit } from './units.ts';

export const surface = shallowRef<MeasureDraw | null>(null);
export const pinia = shallowRef<Pinia | null>(null);
export const active = ref(false);
export const unit = ref<DistanceUnit>('mile');

// Shared between the pane body (confirm prompt) and the header actions
// (Save as Line button), which core renders as separate components.
export const confirmingSave = ref(false);
export const saving = ref(false);
export const saveError = ref<string | null>(null);

/**
 * True when CloudTAK is in its phone layout. Core turns every floating pane
 * into a full-screen modal there (FloatingPane.vue isModal), which hides the
 * map the ruler needs, so the plugin shows its own bottom sheet instead.
 */
export const mobile = ref(false);

/**
 * Snap layer picked in the pane. Module state rather than component state so
 * it survives the pane moving between the floating pane and the mobile sheet.
 */
export const snapLayer = ref(NO_SNAPPING);

export async function selectSnap(layer: string): Promise<void> {
    snapLayer.value = layer;
    const p = pinia.value;
    const s = surface.value;
    if (!p || !s) return;

    const ok = await selectSnappingLayer(p, layer);
    s.setSnapLayer(ok ? layer : NO_SNAPPING);

    if (!ok && layer !== NO_SNAPPING) {
        console.warn('[measure] snapping unavailable, falling back to straight-line');
        snapLayer.value = NO_SNAPPING;
    }
}

export function setUnitFromProfile(value: unknown): void {
    unit.value = normalizeDistanceUnit(value);
}

/** Is core's Drawing Tools surface currently claiming the map? */
export function coreDrawActive(): boolean {
    const p = pinia.value;
    if (!p) return false;
    return isCoreDrawActive(p);
}

export function open(): void {
    const s = surface.value;
    if (!s) return;
    s.start();
    confirmingSave.value = false;
    saveError.value = null;
    // The picker used to live in the pane and start fresh on every open
    snapLayer.value = NO_SNAPPING;
    active.value = true;

    // Core only discovers snapping-capable basemaps when its own Drawing Tools
    // overlay opens (DrawOverlay.vue:416). The ruler must trigger it, or the
    // snap layer picker stays empty and updateGraph() has no tile definitions.
    const p = pinia.value;
    if (p) void populateSnappingLayers(p);
}

export function close(): void {
    const s = surface.value;
    if (s) s.stop();
    active.value = false;

    // Hand core's snapping state back untouched, so we don't leave Drawing
    // Tools pre-armed with a layer the user never picked — and so nothing keeps
    // tile-covering the viewport on pan.
    const p = pinia.value;
    if (p) void resetSnappingLayer(p);
}

export function toggle(): void {
    if (active.value) close();
    else open();
}
