export const MEASURE_BOTTOM_BAR_KEY = 'measure';

export type BottomBarLike = {
    remove: (key: string) => void;
};

/**
 * CloudTAK renders PluginPane (a 50px strip) whenever any bottom-bar item
 * is registered. The ruler button is teleported out of that slot, so
 * registering it leaves the strip empty. Drop a stale `measure` key and
 * mount the toggle ourselves.
 */
export function attachMeasureChrome(host: {
    bottomBar: BottomBarLike;
    mountToggle: () => void;
}): void {
    host.bottomBar.remove(MEASURE_BOTTOM_BAR_KEY);
    host.mountToggle();
}

export function detachMeasureChrome(host: {
    bottomBar: BottomBarLike;
    unmountToggle: () => void;
}): void {
    host.unmountToggle();
    host.bottomBar.remove(MEASURE_BOTTOM_BAR_KEY);
}
