import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('terrain basemap config', () => {
    it('always asks the server for map::terrain', () => {
        const src = readFileSync(new URL('../lib/core-bridge.ts', import.meta.url), 'utf8');
        const start = src.indexOf('export async function terrainBasemapId');
        const next = src.indexOf('\nexport ', start + 1);
        const body = src.slice(start, next === -1 ? undefined : next);

        expect(body).toContain("std('/api/config?keys=map::terrain')");
    });
});
