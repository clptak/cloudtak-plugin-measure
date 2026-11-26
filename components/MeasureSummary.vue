<template>
    <div class='d-flex align-items-baseline gap-2 text-nowrap'>
        <div
            class='fw-bold'
            :class='compact ? "fs-3" : "fs-2"'
        >
            {{ formatDistance(measurement.totalKm, unit) }}
        </div>
        <div
            class='subheader'
            :class='{ "ms-auto": !compact }'
        >
            {{ measurement.coordinates.length }} pts
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { surface, unit } from '../lib/state.ts';
import { formatDistance } from '../lib/units.ts';

defineProps<{
    /** Smaller type for the mobile sheet's one-line header */
    compact?: boolean;
}>();

const measurement = computed(() => {
    return surface.value?.measurement.value
        ?? { coordinates: [], totalKm: 0, segments: [] };
});
</script>
