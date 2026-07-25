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
import {
    measure,
    nearestWithin,
    snapThresholdKm,
    EMPTY_MEASUREMENT,
    type Measurement,
} from './geometry.ts';

import {
    coreRoutingGraph,
    expandGraphForViewport,
    snapPoints,
    NO_SNAPPING,
} from './core-bridge.ts';

export const LINESTRING_MODE = 'linestring';
export const ROUTESNAP_MODE = 'routesnap';
export const STATIC_MODE = 'static';

/** Our namespace for every map source/layer this plugin creates */
export const PREFIX = 'measure';

const MEASURE_COLOR = '#1E90FF';

export type { Segment, Measurement } from './geometry.ts';

export default class MeasureDraw {
    private pinia: Pinia;
    private map: mapgl.Map;
    private draw: terraDraw.TerraDraw;
    private onMoveEnd: () => void;
    /** terra-draw exposes no getModeNames(), so track what we registered */
    private hasRouteSnap: boolean;
    /** Coordinates of nearby CoT features, for snapping a vertex onto a marker */
    private markerPoints: Set<[number, number]>;
    /** Swallows canvas clicks so core never opens a radial menu while measuring */
    private swallowClick: (ev: MouseEvent) => void;

    /** Live measurement, updated on every vertex change */
    public readonly measurement: ShallowRef<Measurement>;
    /** Is the ruler currently accepting clicks? */
    public readonly active: Ref<boolean>;
    /** Currently selected snapping layer, or NO_SNAPPING */
    public readonly snapLayer: Ref<string>;

    constructor(map: mapgl.Map, pinia: Pinia) {
        this.map = map;
        this.pinia = pinia;

        this.measurement = shallowRef<Measurement>(EMPTY_MEASUREMENT);
        this.active = ref(false);
        this.snapLayer = ref(NO_SNAPPING);

        this.markerPoints = new Set();

        /**
         * Snap a vertex onto a nearby CoT marker.
         *
         * Mirrors core's `toCustom` (draw.ts:186-212) including its
         * zoom-scaled threshold, so ending a measurement exactly on a marker
         * works without having to click slightly off it.
         */
        const toCustom = (event: terraDraw.TerraDrawMouseEvent): Position | undefined => {
            return nearestWithin(
                [event.lng, event.lat],
                this.markerPoints.values(),
                snapThresholdKm(this.map.getZoom())
            );
        };

        type ModeList = ConstructorParameters<typeof terraDraw.TerraDraw>[0]['modes'];

        const modes: ModeList = [
            new terraDraw.TerraDrawLineStringMode({
                editable: true,
                snapping: { toCustom },
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

        this.onMoveEnd = () => {
            if (!this.active.value) return;
            void this.refreshMarkerPoints();
            // Mirrors core's graph expansion on pan (draw.ts:131)
            if (this.snapLayer.value === NO_SNAPPING) return;
            void expandGraphForViewport(this.pinia);
        };
        this.map.on('moveend', this.onMoveEnd);

        /**
         * While measuring, stop map clicks from reaching CloudTAK core.
         *
         * Core's click handler (map.ts:1135) bails out only when its OWN draw
         * mode is non-STATIC. The ruler leaves core in STATIC, so without this
         * a click on a marker opens the radial menu instead of placing a vertex.
         *
         * MapLibre binds `click` on `map.getCanvasContainer()` (bubble phase);
         * terra-draw binds on the child `map.getCanvas()`. A bubble-phase
         * listener on the canvas therefore runs alongside terra-draw's own
         * handlers but stops the event before it reaches MapLibre's container
         * listener. `stopPropagation` (not `stopImmediatePropagation`) is
         * deliberate — sibling listeners on the canvas must still fire.
         */
        this.swallowClick = (ev: MouseEvent) => {
            if (!this.active.value) return;
            ev.stopPropagation();
        };
    }

    private async refreshMarkerPoints(): Promise<void> {
        try {
            const bounds = this.map.getBounds().toArray() as [number, number][];
            this.markerPoints = await snapPoints(this.pinia, bounds);
        } catch (err) {
            console.warn('[measure] failed to refresh marker snap points', err);
        }
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
        this.map.getCanvas().addEventListener('click', this.swallowClick);
        this.draw.start();
        this.draw.setMode(this.modeForSnapping());
        this.active.value = true;
        void this.refreshMarkerPoints();
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
        this.measurement.value = EMPTY_MEASUREMENT;
        if (this.active.value) {
            this.draw.setMode(this.modeForSnapping());
        }
    }

    /** End the session and remove the drawing from the map */
    public stop(): void {
        if (!this.active.value) return;
        try {
            this.map.getCanvas().removeEventListener('click', this.swallowClick);
        } catch {
            // canvas may already be gone
        }
        try {
            this.draw.setMode(STATIC_MODE);
            this.draw.clear();
            this.draw.stop();
        } catch (err) {
            console.warn('[measure] error stopping draw surface', err);
        }
        this.measurement.value = EMPTY_MEASUREMENT;
        this.active.value = false;
        this.markerPoints = new Set();
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
