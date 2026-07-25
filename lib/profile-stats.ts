/**
 * Pure terrain-profile derivations — no CloudTAK imports, so this is unit
 * testable standalone. The network call lives in `elevation.ts`.
 */

export type ElevationSample = {
    distance: number;
    elevation: number | null;
};

export type ElevationProfile = {
    /** Total line distance in kilometres */
    distance: number;
    samples: ElevationSample[];
};

export type ProfileStats = {
    distanceKm: number;
    minElevation: number;
    maxElevation: number;
    gain: number;
    loss: number;
};

/**
 * Min/max/gain/loss over the samples that actually returned an elevation.
 * Mirrors the derivation in core's `PropertyProfile.vue`.
 */
export function profileStats(profile: ElevationProfile | null): ProfileStats | null {
    if (!profile) return null;

    const points = profile.samples.filter(
        (s): s is ElevationSample & { elevation: number } => s.elevation !== null
    );

    if (!points.length) return null;

    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;
    let gain = 0;
    let loss = 0;

    for (let i = 0; i < points.length; i++) {
        const elevation = points[i].elevation;
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);

        if (i === 0) continue;

        const delta = elevation - points[i - 1].elevation;
        if (delta > 0) gain += delta;
        else loss += Math.abs(delta);
    }

    return { distanceKm: profile.distance, minElevation, maxElevation, gain, loss };
}

/** Metres -> display units. Core stores `display_elevation` as 'feet' or 'meter'. */
export function formatElevation(metres: number, unit: string): string {
    if (unit === 'meter') return `${Math.round(metres).toLocaleString()} m`;
    return `${Math.round(metres * 3.28084).toLocaleString()} ft`;
}
