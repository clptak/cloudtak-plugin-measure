import { describe, expect, it } from 'vitest';
import {
    convertDistance,
    formatDistance,
    formatBearing,
    normalizeDistanceUnit,
    DISTANCE_UNITS,
} from '../lib/units.ts';

describe('convertDistance', () => {
    // Factors are lifted from core's LineLength.vue — these guard against drift
    it('matches core\'s conversion factors', () => {
        expect(convertDistance(1, 'meter')).toBe(1000);
        expect(convertDistance(1, 'kilometer')).toBe(1);
        expect(convertDistance(1, 'mile')).toBe(0.62);
        expect(convertDistance(1, 'feet')).toBe(3280.84);
        expect(convertDistance(1, 'yard')).toBe(1093.61);
    });

    it('rounds to two decimals, as core does', () => {
        expect(convertDistance(1.23456, 'kilometer')).toBe(1.23);
    });

    it('handles zero', () => {
        for (const { value } of DISTANCE_UNITS) {
            expect(convertDistance(0, value)).toBe(0);
        }
    });
});

describe('formatDistance', () => {
    it('appends the unit suffix', () => {
        expect(formatDistance(1, 'kilometer')).toBe('1 km');
        expect(formatDistance(5, 'mile')).toBe('3.11 mi');
    });

    it('covers every declared unit without falling through', () => {
        for (const { value } of DISTANCE_UNITS) {
            expect(formatDistance(2, value)).not.toMatch(/undefined|NaN/);
        }
    });
});

describe('formatBearing', () => {
    it('zero-pads to three digits', () => {
        expect(formatBearing(7)).toBe('007°');
        expect(formatBearing(47)).toBe('047°');
        expect(formatBearing(180)).toBe('180°');
    });

    it('renders due north as 000, not 360', () => {
        expect(formatBearing(0)).toBe('000°');
        expect(formatBearing(360)).toBe('000°');
    });

    it('rounds to the nearest degree', () => {
        expect(formatBearing(46.6)).toBe('047°');
    });
});

describe('normalizeDistanceUnit', () => {
    it('passes through every known unit', () => {
        for (const { value } of DISTANCE_UNITS) {
            expect(normalizeDistanceUnit(value)).toBe(value);
        }
    });

    it('falls back to miles for anything unexpected', () => {
        // ProfileConfig values are server-supplied, so this must not throw
        expect(normalizeDistanceUnit(undefined)).toBe('mile');
        expect(normalizeDistanceUnit(null)).toBe('mile');
        expect(normalizeDistanceUnit('furlong')).toBe('mile');
        expect(normalizeDistanceUnit(42)).toBe('mile');
    });
});
