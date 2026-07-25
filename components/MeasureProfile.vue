<template>
    <div class='px-1 pt-2'>
        <label class='subheader'>Terrain Profile</label>

        <div
            v-if='!terrainId'
            class='text-muted px-1 py-1'
        >
            No terrain basemap is configured (<code>map::terrain</code>).
        </div>

        <div
            v-else-if='!terrainOn'
            class='text-muted px-1 py-1'
        >
            Enable 3D terrain to see a profile.
        </div>

        <div
            v-else-if='coordinates.length < 2'
            class='text-muted px-1 py-1'
        >
            Place at least two points.
        </div>

        <template v-else>
            <div
                v-if='loading'
                class='text-muted px-1 py-1'
            >
                Loading terrain profile…
            </div>

            <div
                v-else-if='error'
                class='text-danger px-1 py-1'
            >
                {{ error }}
            </div>

            <div
                v-else-if='!stats'
                class='text-muted px-1 py-1'
            >
                No terrain samples are available for this line.
            </div>

            <template v-else>
                <div class='row g-1 mb-2'>
                    <div class='col-6'>
                        <div class='subheader'>
                            Gain
                        </div>
                        <div class='fw-semibold'>
                            <IconArrowUp
                                :size='14'
                                stroke='2'
                            />
                            {{ formatElevation(stats.gain, elevationUnit) }}
                        </div>
                    </div>
                    <div class='col-6'>
                        <div class='subheader'>
                            Loss
                        </div>
                        <div class='fw-semibold'>
                            <IconArrowDown
                                :size='14'
                                stroke='2'
                            />
                            {{ formatElevation(stats.loss, elevationUnit) }}
                        </div>
                    </div>
                    <div class='col-6'>
                        <div class='subheader'>
                            Min
                        </div>
                        <div class='fw-semibold'>
                            {{ formatElevation(stats.minElevation, elevationUnit) }}
                        </div>
                    </div>
                    <div class='col-6'>
                        <div class='subheader'>
                            Max
                        </div>
                        <div class='fw-semibold'>
                            {{ formatElevation(stats.maxElevation, elevationUnit) }}
                        </div>
                    </div>
                </div>

                <div style='height: 140px;'>
                    <canvas ref='canvasRef' />
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LineString, Position } from 'geojson';
import Chart from 'chart.js/auto';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-vue';
import ProfileConfig from '../../../src/base/profile.ts';
import { terrainBasemapId, terrainEnabled } from '../lib/core-bridge.ts';
import { pinia } from '../lib/state.ts';
import {
    loadProfile,
    profileStats,
    formatElevation,
    type ElevationProfile,
} from '../lib/elevation.ts';

const props = defineProps<{
    coordinates: Position[];
}>();

const terrainId = ref<number | undefined>(undefined);
const terrainOn = ref(false);
const elevationUnit = ref('feet');

const loading = ref(false);
const error = ref<string | null>(null);
const profile = ref<ElevationProfile | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

let chart: Chart<'line'> | null = null;

const stats = computed(() => profileStats(profile.value));

/** Recompute only when the geometry actually changes, not on every render */
const geometryKey = computed(() => JSON.stringify(props.coordinates));

onMounted(async () => {
    const p = pinia.value;
    if (p) terrainOn.value = terrainEnabled(p);

    terrainId.value = await terrainBasemapId();

    try {
        const display = await ProfileConfig.get('display_elevation');
        if (display?.value) elevationUnit.value = String(display.value);
    } catch {
        // keep the 'feet' default
    }

    await refresh();
});

onBeforeUnmount(() => destroyChart());

watch(geometryKey, () => {
    void refresh();
});

function destroyChart(): void {
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

async function refresh(): Promise<void> {
    if (!terrainId.value || !terrainOn.value || props.coordinates.length < 2) {
        destroyChart();
        profile.value = null;
        return;
    }

    loading.value = true;
    error.value = null;

    const geometry: LineString = {
        type: 'LineString',
        coordinates: props.coordinates,
    };

    try {
        profile.value = await loadProfile(terrainId.value, geometry);
        await nextTick();
        renderChart();
    } catch (err) {
        destroyChart();
        profile.value = null;
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

function renderChart(): void {
    const canvas = canvasRef.value;
    const current = profile.value;
    if (!canvas || !current) return;

    const points = current.samples.filter(
        (s): s is { distance: number; elevation: number } => s.elevation !== null
    );

    destroyChart();

    chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: points.map((s) => s.distance.toFixed(1)),
            datasets: [{
                data: points.map((s) => (
                    elevationUnit.value === 'meter'
                        ? s.elevation
                        : s.elevation * 3.28084
                )),
                borderColor: '#1E90FF',
                backgroundColor: 'rgba(30, 144, 255, 0.15)',
                fill: true,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { ticks: { maxTicksLimit: 4 } },
            },
        },
    });
}
</script>
