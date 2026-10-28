import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('terrain basemap config', () => {
    it('refreshes map::terrain and does not cache a null default', () => {
        const src = readFileSync(new URL('../lib/core-bridge.ts', import.meta.url), 'utf8');
        const start = src.indexOf('export async function terrainBasemapId');
        const next = src.indexOf('\nexport ', start + 1);
        const body = src.slice(start, next === -1 ? undefined : next);

        expect(body).toContain("Config.refresh(['map::terrain'])");
        expect(body).toContain("Config.list(['map::terrain'])");
        expect(src).not.toContain("map::terrain': null");
    });
});
