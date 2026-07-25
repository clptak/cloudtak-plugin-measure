/**
 * Terrain profile sampling.
 *
 * Same two calls core's `PropertyProfile.vue` makes:
 *   1. GET /api/config/tiles                     -> PMTiles base URL
 *   2. POST {base}/tiles/basemap/{id}/elevation  -> { distance, samples[] }
 *
 * Both are same-origin-ish CloudTAK services, so there is no CORS story here.
 */

import { Preferences } from '@capacitor/preferences';
import type { LineString } from 'geojson';
import { server, std, stdurl } from '../../../src/std.ts';

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

let cachedTilesURL: string | null = null;

async function tilesURL(): Promise<string> {
    if (cachedTilesURL) return cachedTilesURL;

    const { data, error } = await server.GET('/api/config/tiles');
    if (error) throw new Error(error.message || 'Failed to load tile configuration');
    if (!data?.url) throw new Error('Tile configuration did not include a PMTiles URL');

    cachedTilesURL = data.url;
    return cachedTilesURL;
}

export async function loadProfile(
    terrainBasemapId: number,
    geometry: LineString,
    samples = 100
): Promise<ElevationProfile> {
    const base = await tilesURL();
    const url = stdurl(new URL(`${base}/tiles/basemap/${terrainBasemapId}/elevation`));

    const { value: token } = await Preferences.get({ key: 'token' });
    if (token) url.searchParams.set('token', token);

    return await std(url, {
        method: 'POST',
        body: { geometry, samples },
    }) as ElevationProfile;
}

/** Min/max/gain/loss over the samples that actually returned an elevation */
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
