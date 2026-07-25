/**
 * Phase 0 spike: a plugin-owned TerraDraw instance running on the same MapLibre
 * map as CloudTAK core's DrawTool.
 *
 * The critical difference from core: this class has NO `worker.db.add()` call
 * anywhere. `on('finish')` recomputes the measurement and stops. Nothing becomes
 * a CoT, so nothing can reach an Active Data Sync.
 *
 * Collision avoidance: terra-draw-maplibre-gl-adapter accepts a `prefixId`
 * option (defaults to "td"). Core uses the default, we use "measure", so our
 * sources/layers are `measure-point`, `measure-linestring`, `measure-polygon`
 * and can never clash with core's `td-*` or the routing control's
 * `cloudtak-routing-*` layers.
 */

import { ref, shallowRef } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import type { Pinia } from 'pinia';
import type { LineString, Position } from 'geojson';
import * as terraDraw from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { TerraDrawRouteSnapMode } from 'terra-draw-route-snap-mode';
import * as mapgl from 'maplibre-gl';
import { v4 as randomUUID } from 'uuid';
import { length } from '@turf/length';

import {
    coreRoutingGraph,
    expandGraphForViewport,
    NO_SNAPPING,
} from './core-bridge.ts';

export const LINESTRING_MODE = 'linestring';
export const ROUTESNAP_MODE = 'routesnap';
export const STATIC_MODE = 'static';

/** Our namespace for every map source/layer this plugin creates */
export const PREFIX = 'measure';

const MEASURE_COLOR = '#1E90FF';

export type Segment = {
    /** Length of this leg in kilometres */
    km: number;
    /** True bearing of this leg, 0-360 */
    bearing: number;
};

export type Measurement = {
    coordinates: Position[];
    /** Total length in kilometres */
    totalKm: number;
    segments: Segment[];
};

const EMPTY: Measurement = { coordinates: [], totalKm: 0, segments: [] };

/**
 * Initial true bearing from `from` to `to`, 0-360.
 *
 * Implemented inline rather than via `@turf/bearing` because CloudTAK's
 * api/web does not depend on that turf package, and plugins resolve their
 * imports against api/web's node_modules.
 */
function trueBearing(from: Position, to: Position): number {
    const toRad = Math.PI / 180;
    const lon1 = from[0] * toRad;
    const lat1 = from[1] * toRad;
    const lon2 = to[0] * toRad;
    const lat2 = to[1] * toRad;

    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
        - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return ((Math.atan2(y, x) / toRad) + 360) % 360;
}

function measure(coordinates: Position[]): Measurement {
    if (coordinates.length < 2) {
        return { coordinates, totalKm: 0, segments: [] };
    }

    const geometry: LineString = { type: 'LineString', coordinates };
    const feature = { type: 'Feature' as const, properties: {}, geometry };

    const segments: Segment[] = [];
    for (let i = 1; i < coordinates.length; i++) {
        const from = coordinates[i - 1];
        const to = coordinates[i];
        const leg: LineString = { type: 'LineString', coordinates: [from, to] };

        segments.push({
            km: length({ type: 'Feature', properties: {}, geometry: leg }),
            bearing: trueBearing(from, to),
        });
    }

    return {
        coordinates,
        totalKm: length(feature),
        segments,
    };
}

export default class MeasureDraw {
    private pinia: Pinia;
    private map: mapgl.Map;
    private draw: terraDraw.TerraDraw;
    private onMoveEnd: () => void;
    /** terra-draw exposes no getModeNames(), so track what we registered */
    private hasRouteSnap: boolean;

    /** Live measurement, updated on every vertex change */
    public readonly measurement: ShallowRef<Measurement>;
    /** Is the ruler currently accepting clicks? */
    public readonly active: Ref<boolean>;
    /** Currently selected snapping layer, or NO_SNAPPING */
    public readonly snapLayer: Ref<string>;

    constructor(map: mapgl.Map, pinia: Pinia) {
        this.map = map;
        this.pinia = pinia;

        this.measurement = shallowRef<Measurement>(EMPTY);
        this.active = ref(false);
        this.snapLayer = ref(NO_SNAPPING);

        type ModeList = ConstructorParameters<typeof terraDraw.TerraDraw>[0]['modes'];

        const modes: ModeList = [
            new terraDraw.TerraDrawLineStringMode({
                editable: true,
                styles: {
                    lineStringColor: () => MEASURE_COLOR,
                    lineStringWidth: () => 3,
                },
            }),
        ];

        // Snapping reuses core's routing graph. If core hasn't built one (or the
        // field moved on an upstream rebase) we simply ship without the snap
        // mode and the ruler stays straight-line only.
        const routing = coreRoutingGraph(pinia);
        this.hasRouteSnap = !!routing;
        if (routing) {
            modes.push(new TerraDrawRouteSnapMode({
                straightLineFallback: {
                    canSnapBackToNetwork: true,
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                routing: routing as any,
                maxPoints: 9999,
                styles: {
                    lineStringColor: () => MEASURE_COLOR,
                    routePointColor: () => MEASURE_COLOR,
                },
            }));
        }

        this.draw = new terraDraw.TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({
                map: this.map,
                // Namespaces every source/layer as `measure-*` instead of `td-*`
                prefixId: PREFIX,
                // @ts-expect-error same cast core uses in draw.ts:260
                lib: mapgl,
            }),
            idStrategy: {
                isValidId: (id: string | number): boolean => typeof id === 'string',
                getId: () => randomUUID(),
            },
            modes,
        });

        this.draw.on('change', () => {
            this.recompute();
        });

        // NOTE: deliberately does NOT persist. Core's equivalent handler
        // (draw.ts:332) ends in `worker.db.add(feat, { authored: true })`.
        this.draw.on('finish', () => {
            this.recompute();
        });

        // Mirrors core's graph expansion on pan (draw.ts:131)
        this.onMoveEnd = () => {
            if (!this.active.value) return;
            if (this.snapLayer.value === NO_SNAPPING) return;
            void expandGraphForViewport(this.pinia);
        };
        this.map.on('moveend', this.onMoveEnd);
    }

    /** The in-progress or finished measurement geometry, if any */
    private drawnCoordinates(): Position[] {
        const features = this.draw.getSnapshot();

        const drawn = features.find((f) => {
            const props = f.properties as Record<string, unknown>;
            return f.geometry.type === 'LineString'
                && !props.closingPoint
                && !props.coordinatePoint
                && !props.snappingPoint
                && !props.midPoint
                && !props.selectionPoint;
        });

        if (!drawn) return [];
        return (drawn.geometry as LineString).coordinates;
    }

    private recompute(): void {
        this.measurement.value = measure(this.drawnCoordinates());
    }

    private modeForSnapping(): string {
        if (this.snapLayer.value === NO_SNAPPING) return LINESTRING_MODE;
        return this.hasRouteSnap ? ROUTESNAP_MODE : LINESTRING_MODE;
    }

    /** Begin a measurement session */
    public start(): void {
        if (this.active.value) return;
        this.draw.start();
        this.draw.setMode(this.modeForSnapping());
        this.active.value = true;
    }

    /** Change snapping layer mid-session */
    public setSnapLayer(layer: string): void {
        this.snapLayer.value = layer;
        if (!this.active.value) return;
        this.draw.setMode(this.modeForSnapping());
    }

    /** Discard the current measurement but stay active */
    public clear(): void {
        this.draw.clear();
        this.measurement.value = EMPTY;
        if (this.active.value) {
            this.draw.setMode(this.modeForSnapping());
        }
    }

    /** End the session and remove the drawing from the map */
    public stop(): void {
        if (!this.active.value) return;
        try {
            this.draw.setMode(STATIC_MODE);
            this.draw.clear();
            this.draw.stop();
        } catch (err) {
            console.warn('[measure] error stopping draw surface', err);
        }
        this.measurement.value = EMPTY;
        this.active.value = false;
    }

    /** Full teardown — called from the plugin's disable() */
    public destroy(): void {
        this.stop();
        try {
            this.map.off('moveend', this.onMoveEnd);
        } catch {
            // map may already be gone
        }
    }

    /** Current geometry as a GeoJSON LineString, for the elevation endpoint */
    public geometry(): LineString | undefined {
        const coordinates = this.measurement.value.coordinates;
        if (coordinates.length < 2) return undefined;
        return { type: 'LineString', coordinates };
    }
}
