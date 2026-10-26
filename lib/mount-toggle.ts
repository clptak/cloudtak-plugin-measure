import { createApp, type App } from 'vue';
import MeasureToggle from '../components/MeasureToggle.vue';

const ROOT_ID = 'measure-toggle-root';

let toggleApp: App | null = null;
let toggleEl: HTMLElement | null = null;

/** Host node only. MeasureToggle teleports the ruler button to <body>. */
export function mountMeasureToggle(): void {
    if (toggleApp) return;

    const el = document.createElement('div');
    el.id = ROOT_ID;
    el.hidden = true;
    document.body.appendChild(el);
    toggleEl = el;

    toggleApp = createApp(MeasureToggle);
    toggleApp.mount(el);
}

export function unmountMeasureToggle(): void {
    if (toggleApp) {
        toggleApp.unmount();
        toggleApp = null;
    }
    toggleEl?.remove();
    toggleEl = null;
    document.getElementById(ROOT_ID)?.remove();
}
