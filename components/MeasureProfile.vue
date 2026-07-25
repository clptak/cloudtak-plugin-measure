<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Terrain Profile'
        >
            <template #icon>
                <IconChartLine
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerBadge
                    v-if='profile'
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    Generated
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                    <div
                        v-if='!terrainId'
                        class='px-1 py-1 text-muted'
                    >
                        No terrain basemap is configured (<code>map::terrain</code>).
                    </div>

                    <div
                        v-else-if='!terrainOn'
                        class='px-1 py-1 text-muted'
                    >
                        Enable 3D terrain to see a profile.
                    </div>

                    <div
                        v-else-if='coordinates.length < 2'
                        class='px-1 py-1 text-muted'
                    >
                        Place at least two points.
                    </div>

                    <template v-else>
                        <TablerLoading
                            v-if='loading'
                            desc='Loading terrain profile'
                        />

                        <div
                            v-else-if='error'
                            class='px-1 py-1 text-danger'
                        >
                            {{ error }}
                        </div>

                        <div
                            v-else-if='!stats'
                            class='px-1 py-1 text-muted'
                        >
                            No terrain samples are available for this line.
                        </div>

                        <template v-else>
                            <div
                                class='mb-2'
                                role='menu'
                            >
                                <span
                                    class='my-1 px-2 user-select-none'
                                    :class='{
                                        "cloudtak-accent rounded-bottom text-blue": elevationUnit === "feet",
                                        "cursor-pointer": elevationUnit !== "feet",
                                    }'
                                    title='Feet'
                                    role='menuitem'
                                    tabindex='0'
                                    @keyup.enter='elevationUnit = "feet"'
                                    @click='elevationUnit = "feet"'
                                >Feet</span>
                                <span
                                    class='my-1 px-2 user-select-none'
                                    :class='{
                                        "cloudtak-accent rounded-bottom text-blue": elevationUnit === "meter",
                                        "cursor-pointer": elevationUnit !== "meter",
                                    }'
                                    title='Meters'
                                    role='menuitem'
                                    tabindex='0'
                                    @keyup.enter='elevationUnit = "meter"'
                                    @click='elevationUnit = "meter"'
                                >Meters</span>
                            </div>

                            <div class='row g-2'>
                                <div class='col-6'>
                                    <div class='profile-stat rounded px-2 py-2'>
                                        <div class='subheader'>
                                            Distance
                                        </div>
                                        <div class='fw-semibold'>
                                            {{ displayDistance(stats.distanceKm) }}
                                        </div>
                                    </div>
                                </div>
                                <div class='col-6'>
                                    <div class='profile-stat rounded px-2 py-2'>
                                        <div class='subheader'>
                                            Min / Max
                                        </div>
                                        <div class='fw-semibold'>
                                            {{ displayElevation(stats.minElevation) }} / {{ displayElevation(stats.maxElevation) }}
                                        </div>
                                    </div>
                                </div>
                                <div class='col-6'>
                                    <div class='profile-stat rounded px-2 py-2'>
                                        <div class='subheader'>
                                            Gain
                                        </div>
                                        <div class='fw-semibold text-success d-flex align-items-center gap-1'>
                                            <IconArrowUp :size='16' />
                                            {{ displayElevation(stats.gain) }}
                                        </div>
                                    </div>
                                </div>
                                <div class='col-6'>
                                    <div class='profile-stat rounded px-2 py-2'>
                                        <div class='subheader'>
                                            Loss
                                        </div>
                                        <div class='fw-semibold text-danger d-flex align-items-center gap-1'>
                                            <IconArrowDown :size='16' />
                                            {{ displayElevation(stats.loss) }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                ref='shellRef'
                                class='profile-chart-shell mt-2'
                            >
                                <canvas ref='canvasRef' />
                            </div>
                        </template>
                    </template>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LineString, Position } from 'geojson';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import Chart from 'chart.js/auto';
import { IconChartLine, IconArrowUp, IconArrowDown } from '@tabler/icons-vue';
import { TablerBadge, TablerLoading } from '@tak-ps/vue-tabler';
import SlideDownHeader from '../../../src/components/CloudTAK/util/SlideDownHeader.vue';
import { terrainBasemapId, terrainEnabled } from '../lib/core-bridge.ts';
import { pinia, unit as distanceUnit } from '../lib/state.ts';
import { loadProfile, profileStats, type ElevationProfile } from '../lib/elevation.ts';

const props = defineProps<{
    coordinates: Position[];
}>();

const CHART_HEIGHT = 220;

const expanded = ref(false);
const terrainId = ref<number | undefined>(undefined);
const terrainOn = ref(false);
/**
 * Imperial by default, regardless of the server's `display_elevation` setting.
 * The Feet/Meters toggle above the stats overrides it per session.
 */
const elevationUnit = ref('feet');

const loading = ref(false);
const error = ref<string | null>(null);
const profile = ref<ElevationProfile | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const shellRef = ref<HTMLDivElement | null>(null);
const loadedSignature = ref<string | null>(null);

let chart: Chart<'line'> | null = null;
let resizeObserver: ResizeObserver | null = null;

const stats = computed(() => profileStats(profile.value));

const samples = computed(() => {
    return (profile.value?.samples || []).filter(
        (s): s is { distance: number; elevation: number } => s.elevation !== null
    );
});

const geometryKey = computed(() => JSON.stringify(props.coordinates));

/* -- unit helpers, mirroring core's PropertyProfile.vue -------------------- */

function convertDistance(kilometers: number): number {
    switch (distanceUnit.value) {
        case 'meter': return kilometers * 1000;
        case 'feet': return kilometers * 3280.84;
        case 'yard': return kilometers * 1093.61;
        case 'kilometer': return kilometers;
        case 'mile': return kilometers * 0.621371;
        default: return kilometers;
    }
}

function distanceUnitLabel(): string {
    switch (distanceUnit.value) {
        case 'meter': return 'm';
        case 'feet': return 'ft';
        case 'yard': return 'yd';
        case 'kilometer': return 'km';
        case 'mile': return 'mi';
        default: return distanceUnit.value;
    }
}

function convertElevation(meters: number): number {
    return elevationUnit.value === 'meter' ? meters : meters * 3.28084;
}

function elevationUnitLabel(): string {
    return elevationUnit.value === 'meter' ? 'm' : 'ft';
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1);
}

function formatAxisValue(value: number): string {
    if (!Number.isFinite(value)) return '';
    return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

function displayDistance(kilometers: number): string {
    return `${formatNumber(convertDistance(kilometers))} ${distanceUnitLabel()}`;
}

function displayDistanceRaw(value: number): string {
    return `${formatNumber(value)} ${distanceUnitLabel()}`;
}

function displayElevation(meters: number): string {
    return `${formatNumber(convertElevation(meters))} ${elevationUnitLabel()}`;
}

/* -- lifecycle ------------------------------------------------------------ */

onMounted(async () => {
    const p = pinia.value;
    if (p) terrainOn.value = terrainEnabled(p);

    terrainId.value = await terrainBasemapId();

    if (expanded.value) await refresh();
});

onBeforeUnmount(() => destroyChart());

// Only fetch once the section is actually open, matching core's behaviour
watch([expanded, geometryKey, terrainId], async ([isExpanded]) => {
    if (!isExpanded) return;
    await refresh();
});

// Unit changes need a re-render but not a re-fetch
watch([distanceUnit, elevationUnit], async () => {
    if (!expanded.value || !profile.value) return;
    await nextTick();
    renderChart();
});

function destroyChart(): void {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
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

    const signature = `${terrainId.value}:${geometryKey.value}`;
    if (loadedSignature.value === signature && profile.value) {
        await nextTick();
        renderChart();
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
        loadedSignature.value = signature;
        loading.value = false;
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
    if (!canvasRef.value || !samples.value.length) {
        destroyChart();
        return;
    }

    const data: ChartData<'line'> = {
        datasets: [{
            label: 'Elevation',
            data: samples.value.map((sample) => ({
                x: convertDistance(sample.distance),
                y: convertElevation(sample.elevation),
            })),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
            tension: 0.2,
        }],
    };

    const options: ChartOptions<'line'> = {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        interaction: {
            intersect: false,
            mode: 'index',
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: TooltipItem<'line'>) {
                        return `Elevation: ${displayElevation(
                            elevationUnit.value === 'meter'
                                ? Number(context.parsed.y)
                                : Number(context.parsed.y) / 3.28084
                        )}`;
                    },
                    title(items: TooltipItem<'line'>[]) {
                        if (!items.length) return '';
                        return `Distance: ${displayDistanceRaw(Number(items[0].parsed.x))}`;
                    },
                },
            },
        },
        scales: {
            x: {
                type: 'linear',
                title: {
                    display: true,
                    text: `Distance (${distanceUnitLabel()})`,
                },
                ticks: {
                    callback(value) {
                        return formatAxisValue(Number(value));
                    },
                },
            },
            y: {
                title: {
                    display: true,
                    text: `Elevation (${elevationUnitLabel()})`,
                },
                ticks: {
                    callback(value) {
                        return formatAxisValue(Number(value));
                    },
                },
            },
        },
    };

    destroyChart();
    chart = new Chart(canvasRef.value, { type: 'line', data, options });

    if (shellRef.value) {
        resizeObserver = new ResizeObserver((entries) => {
            if (!chart) return;
            requestAnimationFrame(() => {
                if (!chart) return;
                chart.resize(entries[0].contentRect.width, CHART_HEIGHT);
            });
        });
        resizeObserver.observe(shellRef.value);
    }
}
</script>

<style scoped>
.profile-chart-shell {
    position: relative;
    height: 220px;
    overflow: hidden;
}

.profile-chart-shell canvas {
    position: absolute;
    top: 0;
    left: 0;
}

.profile-stat {
    height: 100%;
    min-height: 3.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

:global(html[data-bs-theme='light'] .profile-stat) {
    background: rgba(15, 23, 42, 0.03);
    border-color: rgba(15, 23, 42, 0.08);
}
</style>
