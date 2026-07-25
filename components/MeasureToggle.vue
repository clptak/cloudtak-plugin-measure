<template>
    <!--
        Registered through api.bottomBar.add(), but renders nothing inline.
        The button is teleported to <body> and positioned under the top map
        controls bar (Map.vue:267-316), which has no plugin hook of its own.

        Offsets derive from --map-compact-menu-size rather than being hardcoded,
        so an upstream chrome restyle is less likely to strand the button.
    -->
    <Teleport to='body'>
        <div class='measure-toggle-shell cloudtak-ctrl-group cloudtak-panel'>
            <div
                role='button'
                tabindex='0'
                class='cloudtak-ctrl-btn'
                :title='active ? "Close Measure Tool" : "Measure Distance"'
                @click='toggle'
                @keyup.enter='toggle'
            >
                <IconRulerMeasure
                    :size='24'
                    stroke='2'
                    :color='active ? "#1E90FF" : undefined'
                />
            </div>
        </div>
    </Teleport>
</template>

<script setup lang='ts'>
import { watch } from 'vue';
import { IconRulerMeasure } from '@tabler/icons-vue';
import { active, toggle, close, coreDrawActive } from '../lib/state.ts';

/**
 * Mutual exclusion. Core's DrawTool.mode is a `ref` behind a getter
 * (draw.ts:55/68), so this fires as soon as the user opens Drawing Tools.
 * Only one draw surface may own map clicks at a time.
 */
watch(coreDrawActive, (isCoreActive) => {
    if (isCoreActive && active.value) close();
});
</script>

<style scoped>
.measure-toggle-shell {
    position: fixed;
    /* The top controls bar is 60px tall (Map.vue:272); sit just under it */
    top: 68px;
    right: calc(var(--map-compact-menu-size, 60px) + 10px);
    /* Matches the z-index of the controls bar itself (Map.vue:271) */
    z-index: 5;
}
</style>
