export function terrainIdFromValue(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const id = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(id) || id <= 0) return undefined;
    return id;
}
