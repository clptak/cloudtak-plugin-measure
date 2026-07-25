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
import ProfileConfig from '../../src/base/profile.ts';

import MeasureDraw from './lib/measure-draw.ts';
import * as state from './lib/state.ts';
import { cancelCoreDraw } from './lib/core-bridge.ts';
import MeasureToggle from './components/MeasureToggle.vue';
import MeasurePane from './components/MeasurePane.vue';

const BOTTOM_BAR_KEY = 'measure';
const FLOAT_UID = 'measure';

export default class MeasurePlugin implements PluginInstance {
    api: PluginAPI;
    private stopActiveWatch?: () => void;

    constructor(api: PluginAPI) {
        this.api = api;
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
            const displayDistance = await ProfileConfig.get('display_distance');
            state.setUnitFromProfile(displayDistance?.value);
        } catch {
            // Fall back to the default ('mile') — units are cosmetic
        }

        try {
            state.surface.value = new MeasureDraw(this.api.map, this.api.pinia);
        } catch (err) {
            console.error('[measure] failed to create draw surface', err);
            return;
        }

        // Opening the ruler cancels any in-progress core geometry, so we never
        // leave a half-drawn CoT behind. The reverse direction (core opening
        // closes the ruler) lives in MeasureToggle.vue.
        this.stopActiveWatch = watch(state.active, async (isActive) => {
            if (isActive) {
                await cancelCoreDraw(this.api.pinia);
                this.api.float.add({
                    uid: FLOAT_UID,
                    name: 'Measure',
                    component: MeasurePane,
                    width: 420,
                    height: 560,
                });
            } else if (this.api.float.has(FLOAT_UID)) {
                this.api.float.remove(FLOAT_UID);
            }
        });

        this.api.bottomBar.add({
            key: BOTTOM_BAR_KEY,
            component: MeasureToggle,
        });
    }

    async disable(): Promise<void> {
        if (this.stopActiveWatch) {
            this.stopActiveWatch();
            this.stopActiveWatch = undefined;
        }

        this.api.bottomBar.remove(BOTTOM_BAR_KEY);

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
