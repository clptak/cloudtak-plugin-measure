/**
 * Plain object rather than `defineConfig` from 'vitest/config' on purpose.
 *
 * Importing vitest's types here drags this plugin's vitest version into any
 * TypeScript program that includes the file. If the plugin is ever present as a
 * real directory under api/web/plugins (which is exactly what the verification
 * step in docs/TESTING.md does), that conflicts with CloudTAK's own vitest
 * version and breaks `vue-tsc` on api/web/vite.config.ts.
 *
 * `defineConfig` is an identity function, so nothing is lost.
 */
export default {
    test: {
        // Only the dependency-free modules are covered here. Components and
        // measure-draw.ts import CloudTAK core and terra-draw, which resolve
        // through api/web's Vite config, not standalone.
        include: ['test/**/*.spec.ts'],
        environment: 'node',
    },
};
