<template>
    <div class='px-2 py-2'>
        <div
            v-if='!surface'
            class='text-muted px-1 py-1'
        >
            Measure tool not ready.
        </div>

        <template v-else>
            <MeasureSummary class='px-1' />
            <MeasureDetails />
        </template>
    </div>
</template>

<script setup lang='ts'>
// Desktop layout, shown in a core floating pane. Phones get MeasureSheet.vue.
import { onBeforeUnmount } from 'vue';
import { surface, active, mobile, close } from '../lib/state.ts';
import MeasureSummary from './MeasureSummary.vue';
import MeasureDetails from './MeasureDetails.vue';

// The floating pane has its own X (FloatingPane.vue:27). Dismissing the pane by
// any route must also leave measure mode, otherwise the ruler keeps swallowing
// map clicks with no visible UI. `close()` is idempotent, so the programmatic
// path (close() -> pane removed -> unmount -> close()) is harmless. The one
// exception: the pane is removed because CloudTAK switched to its phone
// layout, and the measurement carries on in the mobile sheet.
onBeforeUnmount(() => {
    if (active.value && mobile.value) return;
    close();
});
</script>
