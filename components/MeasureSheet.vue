<template>
    <!--
        Phone layout. CloudTAK turns every floating pane into a full-screen
        modal on mobile (FloatingPane.vue isModal), which covers the map the
        ruler draws on (issue #4). This card is docked at the bottom of the
        map instead, the way core's own Line Editing card is on phones
        (DrawOverlay.vue): one compact row, with the rest behind "More".
        Only the card takes touches; the map around it stays usable.
    -->
    <Teleport to='body'>
        <div
            v-if='active && mobile && surface'
            class='measure-sheet card cloudtak-panel user-select-none'
        >
            <!-- Two rows: one row of seven 40px targets does not fit a 360px phone -->
            <div class='measure-sheet-header d-flex align-items-center gap-2 px-2 pt-1'>
                <MeasureSummary
                    compact
                    class='flex-shrink-0'
                />

                <div class='ms-auto d-flex flex-nowrap align-items-center gap-1'>
                    <TablerIconButton
                        :title='expanded ? "Hide settings" : "Show settings"'
                        @click='expanded = !expanded'
                    >
                        <IconChevronDown
                            v-if='expanded'
                            :size='28'
                            stroke='1'
                        />
                        <IconChevronUp
                            v-else
                            :size='28'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        title='Close Measure Tool'
                        @click='close'
                    >
                        <IconX
                            :size='28'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>

            <MeasureActions class='measure-sheet-actions justify-content-around px-2 pb-1' />

            <div
                v-if='expanded'
                class='measure-sheet-body border-top px-2 py-2'
            >
                <MeasureDetails mobile />
            </div>
        </div>
    </Teleport>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-vue';
import { active, mobile, surface, close, confirmingSave, saveError } from '../lib/state.ts';
import MeasureSummary from './MeasureSummary.vue';
import MeasureActions from './MeasureActions.vue';
import MeasureDetails from './MeasureDetails.vue';

/** Collapsed by default so most of the map stays clear */
const expanded = ref(false);

const promptNewMeasurement = computed(() => surface.value?.promptNewMeasurement.value ?? false);

// Anything that needs an answer lives in the details, so open them for it:
// the Save confirmation, a save error and the "Clear & Draw" prompt.
watch(
    () => confirmingSave.value || Boolean(saveError.value) || promptNewMeasurement.value,
    (needsAttention) => {
        if (needsAttention) expanded.value = true;
    },
);

// Start collapsed each time the tool opens
watch(active, (isActive) => {
    if (isActive) expanded.value = false;
});
</script>

<style scoped>
.measure-sheet {
    position: fixed;
    /* Same footprint as core's bottom panes (GenericBottomPane.vue) on phones,
       over the GPS panel. Teleported to <body>, so core's --map-bottom-inset
       is not in scope here and the safe area is read directly. */
    left: calc(8px + env(safe-area-inset-left, 0px));
    right: calc(8px + env(safe-area-inset-right, 0px));
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    z-index: 5;
    margin: 0;
}

.measure-sheet-header {
    min-height: 48px;
}

.measure-sheet-body {
    max-height: 50vh;
    max-height: 50dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
}

/* Larger touch targets for the icon buttons */
.measure-sheet-header :deep([role='button']),
.measure-sheet-actions :deep([role='button']) {
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
</style>
