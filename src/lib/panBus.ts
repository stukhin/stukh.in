/**
 * Shared pan offsets between /blog's map and its Grainient background.
 * Was a pair of custom properties on <html>, which invalidated style
 * for the whole document on every mousemove frame; the bg reads these
 * once per frame instead. Values are CSS px.
 */
const values = new Map<string, number>();

export const setPan = (name: string, px: number) => {
  values.set(name, px);
};

export const getPan = (name: string): number => values.get(name) ?? 0;

export const clearPan = (...names: string[]) => {
  names.forEach((n) => values.delete(n));
};
