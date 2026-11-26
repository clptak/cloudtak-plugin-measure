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

import type { LineString } from 'geojson';
import { apiUrl, getToken, std } from './host.ts';
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

    const data = await std('/api/config/tiles') as { url?: string };
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
    const url = await apiUrl(`${base}/tiles/basemap/${terrainBasemapId}/elevation`);

    // The tile service takes the token in the query, and may be on another host
    const token = await getToken();
    if (token) url.searchParams.set('token', token);

    return await std(url, {
        method: 'POST',
        body: { geometry, samples },
    }) as ElevationProfile;
}
