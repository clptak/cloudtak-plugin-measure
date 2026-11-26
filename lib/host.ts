/**
 * What a runtime plugin needs from CloudTAK that the Plugin API does not expose.
 * Importing them from the app's source would put a second copy of the app inside the
 * runtime bundle, so they are read the way the app stores them: Capacitor Preferences
 * (the `CapacitorGlobal` the app registers, on both web and native).
 */
interface Preferences {
    get(opts: { key: string }): Promise<{ value: string | null }>;
}

const TIMEOUT_MS = 20000;

async function preference(key: string): Promise<string | undefined> {
    const prefs = (globalThis as unknown as {
        Capacitor?: { Plugins?: { Preferences?: Preferences } };
    }).Capacitor?.Plugins?.Preferences;
    if (!prefs) throw new Error('CloudTAK preferences are not available');
    return (await prefs.get({ key })).value || undefined;
}

export function getToken(): Promise<string | undefined> {
    return preference('token');
}

/** The CloudTAK server: the one signed in to on iOS and Android, this origin in a browser. */
export async function getServerUrl(): Promise<string> {
    return await preference('serverUrl') || location.origin;
}

/** Absolute URL of an API path. A full URL is returned unchanged. */
export async function apiUrl(path: string): Promise<URL> {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return new URL(path);
    return new URL((await getServerUrl()).replace(/\/$/, '') + path);
}

export interface StdOptions {
    method?: string;
    /** Plain objects are sent as JSON. */
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeout?: number;
}

/**
 * Authenticated request: parsed JSON for a JSON response, otherwise the Response.
 * It does not refresh an expired session; the app does that for its own requests.
 */
export async function std(url: string | URL, opts: StdOptions = {}): Promise<unknown> {
    const target = await apiUrl(String(url));
    const headers: Record<string, string> = { ...opts.headers };
    // Never send the session token to another host
    if (target.origin === new URL(await getServerUrl()).origin) {
        const token = await getToken();
        if (token) headers.Authorization ??= `Bearer ${token}`;
    }

    let body = opts.body as BodyInit | undefined;
    const plain = Array.isArray(opts.body) || Object.getPrototypeOf(opts.body ?? 0) === Object.prototype;
    if (plain) {
        body = JSON.stringify(opts.body);
        headers['Content-Type'] ??= 'application/json';
    }

    const controller = new AbortController();
    const abort = (): void => controller.abort();
    opts.signal?.addEventListener('abort', abort, { once: true });
    if (opts.signal?.aborted) abort();
    const timer = setTimeout(abort, opts.timeout ?? TIMEOUT_MS);
    try {
        const res = await fetch(target, { method: opts.method, headers, body, signal: controller.signal });
        if (!res.ok) {
            const error = await res.json().catch(() => ({})) as { message?: string };
            throw new Error(error.message || `Status Code: ${res.status}`);
        }
        if (res.headers.get('Content-Type')?.includes('application/json')) return await res.json();
        // Read the body inside the timeout. A 204 must not be given one
        const data = res.status === 204 ? null : await res.blob();
        return new Response(data, { status: res.status, headers: res.headers });
    } catch (err) {
        if (controller.signal.aborted && !opts.signal?.aborted) {
            throw new Error(`Request timed out: ${target.pathname}`, { cause: err });
        }
        throw err;
    } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', abort);
    }
}

/**
 * A live CloudTAK Pinia store, for what the Plugin API lacks. `_s` is Pinia's private
 * registry, so check it still works after upgrades. Ids: 'cloudtak' (map),
 * 'cloudtak-app', 'float', 'device'. A store is only there once the app has used it:
 * call this when needed, not at install time.
 */
export function hostStore<T = Record<string, unknown>>(api: { pinia: unknown }, id: string): T {
    const store = (api.pinia as { _s: Map<string, unknown> })._s.get(id);
    if (!store) throw new Error(`CloudTAK store '${id}' is not available`);
    return store as T;
}
