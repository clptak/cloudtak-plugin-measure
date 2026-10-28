import { describe, expect, it } from 'vitest';
import { terrainIdFromValue } from '../lib/terrain-id.ts';

describe('terrainIdFromValue', () => {
    it('accepts a positive integer basemap id', () => {
        expect(terrainIdFromValue(12)).toBe(12);
        expect(terrainIdFromValue('12')).toBe(12);
    });

    it('rejects unset, zero, negative, and non-integer values', () => {
        expect(terrainIdFromValue(null)).toBeUndefined();
        expect(terrainIdFromValue(undefined)).toBeUndefined();
        expect(terrainIdFromValue('')).toBeUndefined();
        expect(terrainIdFromValue(0)).toBeUndefined();
        expect(terrainIdFromValue(-1)).toBeUndefined();
        expect(terrainIdFromValue(1.5)).toBeUndefined();
        expect(terrainIdFromValue('nope')).toBeUndefined();
        expect(terrainIdFromValue(Number.NaN)).toBeUndefined();
    });
});
