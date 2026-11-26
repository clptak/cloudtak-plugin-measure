import { createApp, type App } from 'vue';
import MeasureSheet from '../components/MeasureSheet.vue';

const ROOT_ID = 'measure-sheet-root';

let sheetApp: App | null = null;

/**
 * Host node only. MeasureSheet teleports itself to <body> and renders only
 * while the ruler is open in CloudTAK's phone layout.
 */
export function mountMeasureSheet(): void {
    if (sheetApp) return;

    const el = document.createElement('div');
    el.id = ROOT_ID;
    el.hidden = true;
    document.body.appendChild(el);

    sheetApp = createApp(MeasureSheet);
    sheetApp.mount(el);
}

export function unmountMeasureSheet(): void {
    if (sheetApp) {
        sheetApp.unmount();
        sheetApp = null;
    }
    document.getElementById(ROOT_ID)?.remove();
}
