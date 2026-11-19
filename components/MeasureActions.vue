<template>
    <div
        v-if='surface'
        class='d-flex flex-nowrap align-items-center gap-1'
    >
        <TablerIconButton
            title='Finish — park the line (Enter)'
            :disabled='!canFinish'
            @click='canFinish && surface.finish()'
        >
            <IconCheck
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            title='Undo — remove the last point (Backspace)'
            :disabled='!undoAvailable'
            @click='undoAvailable && surface.undo()'
        >
            <IconArrowBackUp
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            v-if='redoAvailable'
            title='Redo — restore the last removed point (Cmd/Ctrl+Shift+Z)'
            @click='surface.redo()'
        >
            <IconArrowForwardUp
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            title='Clear — remove the whole measurement'
            :disabled='!coordinateCount'
            @click='coordinateCount && surface.clear()'
        >
            <IconEraser
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            title='Save as Line — save as a CoT line'
            :disabled='!canSave'
            @click='canSave && (confirmingSave = true)'
        >
            <IconDeviceFloppy
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
    </div>
</template>

<script setup lang='ts'>
// TablerIconButton is a plain <div role=button>: `disabled` only styles it and
// does not block click/Enter, so every handler re-checks its own guard.
import { computed } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconCheck,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconEraser,
    IconDeviceFloppy,
} from '@tabler/icons-vue';
import { surface, confirmingSave, saving } from '../lib/state.ts';

const coordinateCount = computed(() => surface.value?.measurement.value.coordinates.length ?? 0);
const undoAvailable = computed(() => surface.value?.undoAvailable.value ?? false);
const redoAvailable = computed(() => surface.value?.redoAvailable.value ?? false);
const finished = computed(() => surface.value?.finished.value ?? false);
const canFinish = computed(() => !finished.value && coordinateCount.value >= 2);
const canSave = computed(() => coordinateCount.value >= 2 && !saving.value);
</script>
