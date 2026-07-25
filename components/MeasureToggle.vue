<template>
    <!--
        Registered through api.bottomBar.add(), but renders nothing inline.
        The button is teleported to <body> and anchored directly beneath the
        left-margin map controls stack (Map.vue:120), which has no plugin hook
        of its own.

        Anchoring to that element rather than using fixed offsets does two jobs:
        the button tracks the stack as it grows/shrinks (the pitch and zoom
        buttons come and go), and because core only renders the stack when
        `mode === "Default"` (Map.vue:116), the button automatically disappears
        on the main menu and every other view instead of floating over them.
    -->
    <Teleport to='body'>
        <div
            v-if='anchor'
            class='measure-toggle-shell cloudtak-ctrl-group cloudtak-panel'
            :style='{ top: `${anchor.top}px`, left: `${anchor.left}px` }'
        >
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IconRulerMeasure } from '@tabler/icons-vue';
import { active, toggle, close, coreDrawActive } from '../lib/state.ts';

/** Gap between the core control stack and our button */
const GAP = 8;

const anchor = ref<{ top: number; left: number } | null>(null);

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let observed: Element | null = null;

/** The core left-margin control stack — never our own teleported element */
function coreControlStack(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        '.cloudtak-ctrl-group:not(.measure-toggle-shell)'
    );
}

function reposition(): void {
    const el = coreControlStack();

    if (!el) {
        // Core hid the map controls (menu open, non-Default mode) — hide too
        anchor.value = null;
        return;
    }

    if (el !== observed) {
        if (resizeObserver && observed) resizeObserver.unobserve(observed);
        observed = el;
        if (resizeObserver) resizeObserver.observe(el);
    }

    const rect = el.getBoundingClientRect();
    anchor.value = { top: rect.bottom + GAP, left: rect.left };
}

onMounted(() => {
    reposition();

    // The stack resizes as the compass/pitch/zoom buttons appear and disappear
    resizeObserver = new ResizeObserver(() => reposition());

    // ...and is added/removed wholesale when the view mode changes
    mutationObserver = new MutationObserver(() => reposition());
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', reposition);
});

onBeforeUnmount(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    observed = null;
    window.removeEventListener('resize', reposition);
});

// If core hides the map controls while a measurement is open, close the ruler
// so we never leave an invisible tool capturing map clicks.
watch(anchor, (value) => {
    if (!value && active.value) close();
});

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
    /* Above the map, below core's top control bar (z-index 5, Map.vue:271) */
    z-index: 4;
}
</style>
