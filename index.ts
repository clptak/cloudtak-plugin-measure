/**
 * CloudTAK Measure plugin — Caltopo-style ruler.
 *
 * Phase 0 spike scope: prove that a plugin can own a TerraDraw surface on the
 * shared MapLibre map, measure distance and bearing, optionally snap to core's
 * routing graph, and create NO CoT feature in the process.
 *
 * See docs/PLAN.md for the full phased plan.
 */

import type { App } from 'vue';
import { watch } from 'vue';
import type { PluginAPI, PluginInstance } from '../../plugin.ts';

import MeasureDraw from './lib/measure-draw.ts';
import * as state from './lib/state.ts';
import { cancelCoreDraw } from './lib/core-bridge.ts';
import { mountMeasureToggle, unmountMeasureToggle } from './lib/mount-toggle.ts';
import { attachMeasureChrome, detachMeasureChrome } from './lib/toggle-host.ts';
import { mountMeasureSheet, unmountMeasureSheet } from './lib/mount-sheet.ts';
import { hostStore } from './lib/host.ts';
import MeasurePane from './components/MeasurePane.vue';
import MeasureActions from './components/MeasureActions.vue';

const FLOAT_UID = 'measure';

export default class MeasurePlugin implements PluginInstance {
    api: PluginAPI;
    private stopActiveWatch?: () => void;
    private stopMobileWatch?: () => void;
    private stopLayoutWatch?: () => void;

    constructor(api: PluginAPI) {
        this.api = api;
    }

    /**
     * CloudTAK's own phone-layout flag (Map.vue sets it from screen size and
     * device). Read reactively, so the watcher follows rotation and resizes.
     * Before the app store exists, fall back to the same test Map.vue
     * detectMobile() uses: either side of the window 576px or less.
     */
    private isMobileLayout(): boolean {
        try {
            return Boolean(hostStore<{ isMobileDetected?: boolean }>(this.api, 'cloudtak-app').isMobileDetected);
        } catch {
            return window.matchMedia('(max-width: 576px), (max-height: 576px)').matches;
        }
    }

    static async install(
        _app: App,
        api: PluginAPI
    ): Promise<PluginInstance> {
        return new MeasurePlugin(api);
    }

    async enable(): Promise<void> {
        state.pinia.value = this.api.pinia;

        try {
            state.setUnitFromProfile(await this.api.profile.get('display_distance'));
        } catch {
            // Fall back to the default ('mile') — units are cosmetic
        }

        try {
            state.surface.value = new MeasureDraw(this.api.map, this.api.pinia);
        } catch (err) {
            console.error('[measure] failed to create draw surface', err);
            return;
        }

        // CloudTAK's phone layout. Core shows every floating pane as a
        // full-screen modal there, covering the map, so the ruler uses its own
        // bottom sheet (MeasureSheet.vue) instead of api.float (issue #4).
        this.stopMobileWatch = watch(() => this.isMobileLayout(), (isMobile) => {
            state.mobile.value = isMobile;
        }, { immediate: true });
        mountMeasureSheet();

        // Opening the ruler cancels any in-progress core geometry, so we never
        // leave a half-drawn CoT behind. The reverse direction (core opening
        // closes the ruler) lives in MeasureToggle.vue.
        this.stopActiveWatch = watch(state.active, async (isActive) => {
            if (isActive) await cancelCoreDraw(this.api.pinia);
        });

        // The floating pane is the desktop layout only. Switching layout while
        // measuring moves the measurement between the pane and the sheet.
        this.stopLayoutWatch = watch([state.active, state.mobile], ([isActive, isMobile]) => {
            if (isActive && !isMobile) {
                if (!this.api.float.has(FLOAT_UID)) {
                    this.api.float.add({
                        uid: FLOAT_UID,
                        name: 'Measure',
                        component: MeasurePane,
                        actions: MeasureActions,
                        width: 420,
                        height: 560,
                    });
                }
            } else if (this.api.float.has(FLOAT_UID)) {
                this.api.float.remove(FLOAT_UID);
            }
        });

        // Not a bottom-bar item: PluginPane stays 50px tall for every
        // registered key, and the ruler is teleported out of that slot.
        attachMeasureChrome({
            bottomBar: this.api.bottomBar,
            mountToggle: mountMeasureToggle,
        });
    }

    async disable(): Promise<void> {
        for (const stop of [this.stopActiveWatch, this.stopLayoutWatch, this.stopMobileWatch]) {
            stop?.();
        }
        this.stopActiveWatch = undefined;
        this.stopLayoutWatch = undefined;
        this.stopMobileWatch = undefined;

        unmountMeasureSheet();

        detachMeasureChrome({
            bottomBar: this.api.bottomBar,
            unmountToggle: unmountMeasureToggle,
        });

        if (this.api.float.has(FLOAT_UID)) {
            this.api.float.remove(FLOAT_UID);
        }

        if (state.surface.value) {
            state.surface.value.destroy();
            state.surface.value = null;
        }

        state.active.value = false;
        state.pinia.value = null;
    }
}
