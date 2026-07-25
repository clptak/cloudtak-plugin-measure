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
import { isCoreDrawActive } from './core-bridge.ts';
import { normalizeDistanceUnit } from './units.ts';
import type { DistanceUnit } from './units.ts';

export const surface = shallowRef<MeasureDraw | null>(null);
export const pinia = shallowRef<Pinia | null>(null);
export const active = ref(false);
export const unit = ref<DistanceUnit>('mile');

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
    active.value = true;
}

export function close(): void {
    const s = surface.value;
    if (s) s.stop();
    active.value = false;
}

export function toggle(): void {
    if (active.value) close();
    else open();
}
