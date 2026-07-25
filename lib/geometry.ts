/**
 * Pure measurement maths — no CloudTAK, terra-draw or turf imports.
 *
 * Kept dependency-free so it can be unit tested standalone. `haversineKm`
 * reproduces `@turf/distance` exactly (same formula, same earth radius of
 * 6371008.8 m from `@turf/helpers`), so totals stay consistent with core's
 * `LineLength.vue`, which uses `@turf/length`.
 */

export type Position = number[];

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

export const EMPTY_MEASUREMENT: Measurement = {
    coordinates: [],
    totalKm: 0,
    segments: [],
};

/** Mean earth radius in kilometres, matching @turf/helpers `earthRadius` */
const EARTH_RADIUS_KM = 6371.0088;

const RAD = Math.PI / 180;

/** Great-circle distance in kilometres between two [lon, lat] positions */
export function haversineKm(from: Position, to: Position): number {
    const dLat = (to[1] - from[1]) * RAD;
    const dLon = (to[0] - from[0]) * RAD;
    const lat1 = from[1] * RAD;
    const lat2 = to[1] * RAD;

    const a = Math.sin(dLat / 2) ** 2
        + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_KM;
}

/** Initial true bearing from `from` to `to`, normalised to 0-360 */
export function trueBearing(from: Position, to: Position): number {
    const lon1 = from[0] * RAD;
    const lat1 = from[1] * RAD;
    const lon2 = to[0] * RAD;
    const lat2 = to[1] * RAD;

    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
        - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** Per-segment lengths and bearings, plus the running total */
export function measure(coordinates: Position[]): Measurement {
    if (coordinates.length < 2) {
        return { coordinates, totalKm: 0, segments: [] };
    }

    const segments: Segment[] = [];
    let totalKm = 0;

    for (let i = 1; i < coordinates.length; i++) {
        const from = coordinates[i - 1];
        const to = coordinates[i];
        const km = haversineKm(from, to);

        totalKm += km;
        segments.push({ km, bearing: trueBearing(from, to) });
    }

    return { coordinates, totalKm, segments };
}

/**
 * Index of the position in `candidates` closest to `target`, or -1.
 * Extracted from the marker-snapping path so the threshold logic is testable.
 */
export function nearestWithin(
    target: Position,
    candidates: Iterable<Position>,
    thresholdKm: number
): Position | undefined {
    let closest: { dist: number; coord: Position } | undefined;

    for (const coord of candidates) {
        const dist = haversineKm(target, coord);
        if (!closest || dist < closest.dist) closest = { dist, coord };
    }

    if (!closest) return undefined;
    return closest.dist < thresholdKm ? closest.coord : undefined;
}

/**
 * Zoom-scaled snap threshold in kilometres, mirroring core's `toCustom`
 * (`draw.ts:203`): base 1000 / 2^zoom.
 */
export function snapThresholdKm(zoom: number): number {
    return 1000 / Math.pow(2, zoom);
}
