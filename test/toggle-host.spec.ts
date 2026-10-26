import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
    MEASURE_BOTTOM_BAR_KEY,
    attachMeasureChrome,
    detachMeasureChrome,
} from '../lib/toggle-host.ts';

describe('measure chrome', () => {
    it('clears a stale bottom-bar key and mounts the ruler on attach', () => {
        const remove = vi.fn();
        const mountToggle = vi.fn();

        attachMeasureChrome({
            bottomBar: {
                remove: (key: string) => {
                    remove(key);
                },
            },
            mountToggle,
        });

        expect(remove).toHaveBeenCalledWith(MEASURE_BOTTOM_BAR_KEY);
        expect(mountToggle).toHaveBeenCalledOnce();
    });

    it('unmounts the ruler and clears a stale bottom-bar key on detach', () => {
        const remove = vi.fn();
        const unmountToggle = vi.fn();

        detachMeasureChrome({
            bottomBar: {
                remove: (key: string) => {
                    remove(key);
                },
            },
            unmountToggle,
        });

        expect(unmountToggle).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledWith(MEASURE_BOTTOM_BAR_KEY);
    });

    it('keeps index.ts from calling bottomBar.add', () => {
        const src = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
        expect(src).not.toMatch(/bottomBar\.add/);
    });
});
