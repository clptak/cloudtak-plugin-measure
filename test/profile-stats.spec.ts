import { describe, expect, it } from 'vitest';
import { profileStats, formatElevation } from '../lib/profile-stats.ts';
import type { ElevationProfile } from '../lib/profile-stats.ts';

function profile(elevations: (number | null)[]): ElevationProfile {
    return {
        distance: 10,
        samples: elevations.map((elevation, i) => ({ distance: i, elevation })),
    };
}

describe('profileStats', () => {
    it('returns null for a missing profile', () => {
        expect(profileStats(null)).toBeNull();
    });

    it('returns null when no sample has an elevation', () => {
        expect(profileStats(profile([null, null, null]))).toBeNull();
    });

    it('computes min and max', () => {
        const stats = profileStats(profile([100, 250, 50, 175]));
        expect(stats?.minElevation).toBe(50);
        expect(stats?.maxElevation).toBe(250);
    });

    it('accumulates gain and loss separately', () => {
        // +100, -50, +25  =>  gain 125, loss 50
        const stats = profileStats(profile([100, 200, 150, 175]));
        expect(stats?.gain).toBe(125);
        expect(stats?.loss).toBe(50);
    });

    it('reports zero gain and loss for flat terrain', () => {
        const stats = profileStats(profile([100, 100, 100]));
        expect(stats?.gain).toBe(0);
        expect(stats?.loss).toBe(0);
        expect(stats?.minElevation).toBe(100);
        expect(stats?.maxElevation).toBe(100);
    });

    it('skips null samples rather than treating them as zero', () => {
        // A naive implementation would see a huge drop to 0 and back
        const stats = profileStats(profile([100, null, 120]));
        expect(stats?.minElevation).toBe(100);
        expect(stats?.gain).toBe(20);
        expect(stats?.loss).toBe(0);
    });

    it('handles a single valid sample', () => {
        const stats = profileStats(profile([null, 500, null]));
        expect(stats?.minElevation).toBe(500);
        expect(stats?.maxElevation).toBe(500);
        expect(stats?.gain).toBe(0);
        expect(stats?.loss).toBe(0);
    });

    it('carries the server-reported distance through', () => {
        expect(profileStats(profile([1, 2]))?.distanceKm).toBe(10);
    });

    it('copes with negative elevations below sea level', () => {
        const stats = profileStats(profile([-50, -10, -80]));
        expect(stats?.minElevation).toBe(-80);
        expect(stats?.maxElevation).toBe(-10);
        expect(stats?.gain).toBe(40);
        expect(stats?.loss).toBe(70);
    });
});

describe('formatElevation', () => {
    it('renders metres unchanged', () => {
        expect(formatElevation(1234, 'meter')).toBe('1,234 m');
    });

    it('converts to feet by default', () => {
        expect(formatElevation(1000, 'feet')).toBe('3,281 ft');
        expect(formatElevation(1000, 'anything-else')).toBe('3,281 ft');
    });

    it('rounds to whole units', () => {
        expect(formatElevation(10.4, 'meter')).toBe('10 m');
    });
});
