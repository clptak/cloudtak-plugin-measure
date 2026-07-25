/**
 * Terrain profile fetching.
 *
 * Same two calls core's `PropertyProfile.vue` makes:
 *   1. GET /api/config/tiles                     -> PMTiles base URL
 *   2. POST {base}/tiles/basemap/{id}/elevation  -> { distance, samples[] }
 *
 * Both are CloudTAK's own services, so there is no CORS story here.
 *
 * The pure derivations live in `profile-stats.ts` so they can be unit tested
 * without pulling in CloudTAK; they are re-exported here for convenience.
 */

import { Preferences } from '@capacitor/preferences';
import type { LineString } from 'geojson';
import { server, std, stdurl } from '../../../src/std.ts';
import type { ElevationProfile } from './profile-stats.ts';

export type {
    ElevationSample,
    ElevationProfile,
    ProfileStats,
} from './profile-stats.ts';

export { profileStats, formatElevation } from './profile-stats.ts';

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
