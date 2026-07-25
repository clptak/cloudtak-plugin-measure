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
                v-if='measurement.segments.length'
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

            <div class='btn-list px-1 pt-2'>
                <button
                    class='btn btn-sm'
                    :disabled='!measurement.coordinates.length'
                    @click='surface.clear()'
                >
                    Clear
                </button>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { surface, unit, pinia } from '../lib/state.ts';
import { snappingOptions, selectSnappingLayer, NO_SNAPPING } from '../lib/core-bridge.ts';
import { DISTANCE_UNITS, formatDistance, formatBearing } from '../lib/units.ts';

const measurement = computed(() => {
    return surface.value?.measurement.value
        ?? { coordinates: [], totalKm: 0, segments: [] };
});

const snapOptions = computed(() => {
    const p = pinia.value;
    return p ? snappingOptions(p) : [NO_SNAPPING];
});

const snapLayer = ref(NO_SNAPPING);

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
