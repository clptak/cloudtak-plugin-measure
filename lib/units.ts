/**
 * Distance formatting, mirroring the unit set and conversion factors used by
 * CloudTAK core's `api/web/src/components/CloudTAK/util/LineLength.vue`.
 */

export type DistanceUnit = 'feet' | 'yard' | 'meter' | 'kilometer' | 'mile';

export const DISTANCE_UNITS: { value: DistanceUnit; label: string }[] = [
    { value: 'feet', label: 'Feet' },
    { value: 'yard', label: 'Yards' },
    { value: 'meter', label: 'Meters' },
    { value: 'kilometer', label: 'Kilometers' },
    { value: 'mile', label: 'Miles' },
];

const FROM_KM: Record<DistanceUnit, number> = {
    meter: 1000,
    feet: 3280.84,
    yard: 1093.61,
    kilometer: 1,
    mile: 0.621371,
};

const SUFFIX: Record<DistanceUnit, string> = {
    meter: 'm',
    feet: 'ft',
    yard: 'yd',
    kilometer: 'km',
    mile: 'mi',
};

export function convertDistance(km: number, unit: DistanceUnit): number {
    return Number((km * FROM_KM[unit]).toFixed(2));
}

export function formatDistance(km: number, unit: DistanceUnit): string {
    return `${convertDistance(km, unit).toLocaleString()} ${SUFFIX[unit]}`;
}

/**
 * Core stores `display_distance` as one of these values via ProfileConfig.
 * Anything unexpected falls back to miles, matching LineLength.vue's default.
 */
export function normalizeDistanceUnit(value: unknown): DistanceUnit {
    const known = DISTANCE_UNITS.map((u) => u.value) as string[];
    if (typeof value === 'string' && known.includes(value)) {
        return value as DistanceUnit;
    }
    return 'mile';
}

/** Format a true bearing as a 3-digit heading, e.g. `047°` */
export function formatBearing(deg: number): string {
    return `${String(Math.round(deg) % 360).padStart(3, '0')}°`;
}
