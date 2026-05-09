/**
 * Static manifest of which gallery photos have horizontal alternates.
 * Drives the orientation toggle in GalleryModal — the horizontal
 * button is hidden when the current photo only ships in vertical,
 * and vice-versa, so the user never picks an orientation that
 * doesn't actually exist.
 *
 * Indices below are 1-based to match the on-disk filenames
 * ("01.jpg" … "21.jpg"). Add a number here when a horizontal
 * crop lands in /public/images/gallery/<category>/horizontal/.
 */
export type GalleryCategory = "nature" | "city";

export const HORIZONTAL_AVAILABLE: Record<GalleryCategory, ReadonlySet<number>> = {
  nature: new Set([1, 3, 4, 7, 11]),
  city: new Set(),
};

export const VERTICAL_AVAILABLE: Record<GalleryCategory, ReadonlySet<number>> = {
  // All vertical crops exist for the 21 nature + 7 city photos we
  // currently ship. Listed explicitly so missing assets are easy to
  // spot (the modal will hide the vertical button if a slide isn't
  // here either).
  nature: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]),
  city: new Set([1, 2, 3, 4, 5, 6, 7]),
};

export function hasHorizontal(
  category: GalleryCategory,
  zeroBasedIndex: number
): boolean {
  return HORIZONTAL_AVAILABLE[category].has(zeroBasedIndex + 1);
}

export function hasVertical(
  category: GalleryCategory,
  zeroBasedIndex: number
): boolean {
  return VERTICAL_AVAILABLE[category].has(zeroBasedIndex + 1);
}
