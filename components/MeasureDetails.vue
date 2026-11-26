<template>
    <div v-if='surface'>
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
                    "d-inline-block py-1": mobile,
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
                :value='snapLayer'
                class='form-select'
                :class='{ "form-select-sm": !mobile }'
                @change='selectSnap(($event.target as HTMLSelectElement).value)'
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

        <div
            v-if='!mobile'
            class='subheader px-1 pt-2 text-muted'
        >
            Enter / Finish parks the line · Esc finishes or clears a short draft · Backspace removes last point
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import {
    surface,
    unit,
    pinia,
    close,
    confirmingSave,
    saving,
    saveError,
    snapLayer,
    selectSnap,
} from '../lib/state.ts';
import { snappingOptions, saveLine, NO_SNAPPING } from '../lib/core-bridge.ts';
import { DISTANCE_UNITS, formatDistance, formatBearing } from '../lib/units.ts';
import MeasureProfile from './MeasureProfile.vue';

defineProps<{
    /** Touch layout: larger targets, no keyboard hint */
    mobile?: boolean;
}>();

const measurement = computed(() => {
    return surface.value?.measurement.value
        ?? { coordinates: [], totalKm: 0, segments: [] };
});

const finished = computed(() => surface.value?.finished.value ?? false);
const promptNewMeasurement = computed(() => surface.value?.promptNewMeasurement.value ?? false);

const snapOptions = computed(() => {
    const p = pinia.value;
    return p ? snappingOptions(p) : [NO_SNAPPING];
});

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
</script>
