import { describe, expect, it } from 'vitest';
import {
    haversineKm,
    trueBearing,
    measure,
    nearestWithin,
    snapThresholdKm,
} from '../lib/geometry.ts';

describe('haversineKm', () => {
    it('matches a known great-circle distance', () => {
        // JFK -> LHR, ~5555 km
        const km = haversineKm([-73.7781, 40.6413], [-0.4543, 51.4700]);
        expect(km).toBeGreaterThan(5540);
        expect(km).toBeLessThan(5570);
    });

    it('measures one degree of latitude as ~111.19 km', () => {
        // Guards the earth radius constant against drift from @turf/helpers
        expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.195, 2);
    });

    it('is zero for identical positions', () => {
        expect(haversineKm([-105, 39.7], [-105, 39.7])).toBe(0);
    });

    it('is symmetric', () => {
        const a: number[] = [-105.1, 39.7];
        const b: number[] = [-104.9, 39.9];
        expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
    });
});

describe('trueBearing', () => {
    it('reads 000 due north', () => {
        expect(trueBearing([0, 0], [0, 1])).toBeCloseTo(0, 6);
    });

    it('reads 090 due east', () => {
        expect(trueBearing([0, 0], [1, 0])).toBeCloseTo(90, 6);
    });

    it('reads 180 due south', () => {
        expect(trueBearing([0, 1], [0, 0])).toBeCloseTo(180, 6);
    });

    it('normalises west to 270 rather than -90', () => {
        expect(trueBearing([0, 0], [-1, 0])).toBeCloseTo(270, 6);
    });

    it('always returns a value in [0, 360)', () => {
        const points: number[][] = [
            [-105, 39], [-104, 40], [-106, 38], [12, -33], [-179, 60], [179, 60],
        ];

        for (const from of points) {
            for (const to of points) {
                if (from === to) continue;
                const b = trueBearing(from, to);
                expect(b).toBeGreaterThanOrEqual(0);
                expect(b).toBeLessThan(360);
            }
        }
    });

    it('handles the antimeridian without wrapping the long way round', () => {
        // Just west of the dateline to just east of it — should read roughly east
        const b = trueBearing([179.9, 0], [-179.9, 0]);
        expect(b).toBeCloseTo(90, 3);
    });
});

describe('measure', () => {
    it('returns an empty measurement for fewer than two points', () => {
        expect(measure([])).toEqual({ coordinates: [], totalKm: 0, segments: [] });

        const single: number[][] = [[-105, 39]];
        expect(measure(single)).toEqual({
            coordinates: single,
            totalKm: 0,
            segments: [],
        });
    });

    it('produces one segment fewer than the vertex count', () => {
        const result = measure([[0, 0], [0, 1], [1, 1], [1, 2]]);
        expect(result.segments).toHaveLength(3);
    });

    it('totals the segment lengths', () => {
        const result = measure([[0, 0], [0, 1], [0, 2]]);
        const sum = result.segments.reduce((acc, s) => acc + s.km, 0);
        expect(result.totalKm).toBeCloseTo(sum, 10);
    });

    it('records the bearing of each leg independently', () => {
        const result = measure([[0, 0], [0, 1], [1, 1]]);
        expect(result.segments[0].bearing).toBeCloseTo(0, 4);

        // Initial great-circle bearing, not rhumb: heading "due east" along a
        // parallel at lat 1 starts at ~89.991, because the great circle bows
        // poleward. Exactly 90 would mean we'd accidentally implemented a
        // rhumb-line bearing.
        expect(result.segments[1].bearing).toBeCloseTo(89.991, 3);
    });

    it('does not mutate the input coordinates', () => {
        const input: number[][] = [[0, 0], [0, 1]];
        const copy = JSON.parse(JSON.stringify(input));
        measure(input);
        expect(input).toEqual(copy);
    });
});

describe('nearestWithin', () => {
    const markers: number[][] = [
        [-105.0, 39.0],
        [-105.5, 39.5],
        [-106.0, 40.0],
    ];

    it('returns the closest candidate inside the threshold', () => {
        const found = nearestWithin([-105.51, 39.51], markers, 5);
        expect(found).toEqual([-105.5, 39.5]);
    });

    it('returns undefined when everything is outside the threshold', () => {
        expect(nearestWithin([-100, 30], markers, 5)).toBeUndefined();
    });

    it('returns undefined for an empty candidate set', () => {
        expect(nearestWithin([-105, 39], [], 1000)).toBeUndefined();
    });

    it('accepts a Set, matching the live marker-point source', () => {
        const set = new Set<number[]>(markers);
        expect(nearestWithin([-105.01, 39.01], set, 5)).toEqual([-105.0, 39.0]);
    });
});

describe('snapThresholdKm', () => {
    it('shrinks as zoom increases', () => {
        expect(snapThresholdKm(10)).toBeGreaterThan(snapThresholdKm(15));
    });

    it('matches core\'s 1000 / 2^zoom formula', () => {
        expect(snapThresholdKm(0)).toBe(1000);
        expect(snapThresholdKm(10)).toBeCloseTo(0.9765625, 10);
    });
});
