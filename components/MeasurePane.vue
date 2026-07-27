<template>
    <div class='px-2 py-2'>
        <div
            v-if='!surface'
            class='text-muted px-1 py-1'
        >
            Measure tool not ready.
        </div>

        <template v-else>
            <div class='d-flex align-items-baseline px-1'>
                <div class='fs-2 fw-bold'>
                    {{ formatDistance(measurement.totalKm, unit) }}
                </div>
                <div class='ms-auto subheader'>
                    {{ measurement.coordinates.length }} pts
                </div>
            </div>

            <div
                class='mx-1 my-1'
                role='menu'
            >
                <span
                    v-for='u in DISTANCE_UNITS'
                    :key='u.value'
                    class='my-1 px-2 user-select-none'
                    :class='{
                        "cloudtak-accent rounded-bottom text-blue": unit === u.value,
                        "cursor-pointer": unit !== u.value,
                    }'
                    role='menuitem'
                    tabindex='0'
                    @keyup.enter='unit = u.value'
                    @click='unit = u.value'
                    v-text='u.label'
                />
            </div>

            <div class='px-1 py-1'>
                <label class='subheader'>Snapping</label>
                <select
                    v-model='snapLayer'
                    class='form-select form-select-sm'
                >
                    <option
                        v-for='opt in snapOptions'
                        :key='opt'
                        :value='opt'
                        v-text='opt'
                    />
                </select>
            </div>

            <div
                v-if='measurement.segments.length && snapLayer === NO_SNAPPING'
                class='px-1 py-1'
            >
                <label class='subheader'>Segments</label>
                <table class='table table-sm table-borderless mb-0'>
                    <tbody>
                        <tr
                            v-for='(seg, idx) in measurement.segments'
                            :key='idx'
                        >
                            <td class='text-muted'>
                                {{ idx + 1 }}
                            </td>
                            <td>{{ formatDistance(seg.km, unit) }}</td>
                            <td class='text-muted'>
                                {{ formatBearing(seg.bearing) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-if='promptNewMeasurement'
                class='cloudtak-accent rounded mx-1 my-2 px-2 py-2'
            >
                <div class='mb-2'>
                    Clear the current measurement and start a new one?
                </div>
                <div class='btn-list'>
                    <button
                        class='btn btn-sm'
                        @click='surface.dismissPrompt()'
                    >
                        Keep
                    </button>
                    <button
                        class='btn btn-sm btn-primary'
                        @click='surface.restart()'
                    >
                        Clear &amp; Draw
                    </button>
                </div>
            </div>

            <MeasureProfile
                :coordinates='measurement.coordinates'
                :finished='finished'
            />

            <div class='btn-list px-1 pt-2'>
                <button
                    class='btn btn-sm'
                    title='Finish the line (Enter)'
                    :disabled='finished || measurement.coordinates.length < 2'
                    @click='surface.finish()'
                >
                    Finish
                </button>
                <button
                    class='btn btn-sm'
                    title='Remove the last point (Backspace)'
                    :disabled='!undoAvailable'
                    @click='surface.undo()'
                >
                    Undo
                </button>
                <button
                    v-if='redoAvailable'
                    class='btn btn-sm'
                    title='Restore the last removed point (Cmd/Ctrl+Shift+Z)'
                    @click='surface.redo()'
                >
                    Redo
                </button>
                <button
                    class='btn btn-sm'
                    :disabled='!measurement.coordinates.length'
                    @click='surface.clear()'
                >
                    Clear
                </button>
                <button
                    class='btn btn-sm'
                    :disabled='measurement.coordinates.length < 2 || saving'
                    @click='confirmingSave = true'
                >
                    Save as Line
                </button>
                <button
                    class='btn btn-sm ms-auto'
                    title='Exit measure mode'
                    @click='close'
                >
                    Close
                </button>
            </div>

            <div
                v-if='confirmingSave'
                class='cloudtak-accent rounded mx-1 mt-2 px-2 py-2'
            >
                <div class='mb-2'>
                    Save this measurement as a CoT line named
                    <span class='fw-bold'>{{ defaultCallsign }}</span>?
                </div>
                <div class='text-warning mb-2'>
                    If a Data Sync is active, this line will be shared to it.
                </div>
                <div class='btn-list'>
                    <button
                        class='btn btn-sm'
                        @click='confirmingSave = false'
                    >
                        Cancel
                    </button>
                    <button
                        class='btn btn-sm btn-primary'
                        :disabled='saving'
                        @click='save'
                    >
                        Save
                    </button>
                </div>
            </div>

            <div
                v-if='saveError'
                class='text-danger px-1 pt-2'
            >
                {{ saveError }}
            </div>

            <div class='subheader px-1 pt-2 text-muted'>
                Enter / Finish parks the line · Esc finishes or clears a short draft · Backspace removes last point
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { surface, unit, pinia, close } from '../lib/state.ts';
import { snappingOptions, selectSnappingLayer, saveLine, NO_SNAPPING } from '../lib/core-bridge.ts';
import { DISTANCE_UNITS, formatDistance, formatBearing } from '../lib/units.ts';
import MeasureProfile from './MeasureProfile.vue';

const measurement = computed(() => {
    return surface.value?.measurement.value
        ?? { coordinates: [], totalKm: 0, segments: [] };
});

const undoAvailable = computed(() => surface.value?.undoAvailable.value ?? false);
const redoAvailable = computed(() => surface.value?.redoAvailable.value ?? false);
const finished = computed(() => surface.value?.finished.value ?? false);
const promptNewMeasurement = computed(() => surface.value?.promptNewMeasurement.value ?? false);

const snapOptions = computed(() => {
    const p = pinia.value;
    return p ? snappingOptions(p) : [NO_SNAPPING];
});

const snapLayer = ref(NO_SNAPPING);

// The floating pane has its own X (FloatingPane.vue:27). Dismissing the pane by
// any route must also leave measure mode, otherwise the ruler keeps swallowing
// map clicks with no visible UI. `close()` is idempotent, so the programmatic
// path (close() -> pane removed -> unmount -> close()) is harmless.
onBeforeUnmount(() => close());

const confirmingSave = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);

const defaultCallsign = computed(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `Measurement ${hh}:${mm}`;
});

async function save(): Promise<void> {
    const p = pinia.value;
    if (!p) return;

    saving.value = true;
    saveError.value = null;

    const id = await saveLine(p, measurement.value.coordinates, defaultCallsign.value);

    saving.value = false;
    confirmingSave.value = false;

    if (!id) {
        saveError.value = 'Could not save the measurement as a line.';
        return;
    }

    // The measurement is now a real CoT feature. Leave measure mode entirely so
    // the user isn't looking at the same line twice, once as an ephemeral
    // overlay and once as the saved feature.
    close();
}

watch(snapLayer, async (layer) => {
    const p = pinia.value;
    if (!p || !surface.value) return;

    const ok = await selectSnappingLayer(p, layer);
    surface.value.setSnapLayer(ok ? layer : NO_SNAPPING);

    if (!ok && layer !== NO_SNAPPING) {
        console.warn('[measure] snapping unavailable, falling back to straight-line');
        snapLayer.value = NO_SNAPPING;
    }
});
</script>
