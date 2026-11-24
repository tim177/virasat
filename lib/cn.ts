/**
 * Joins class names, skipping empty values.
 * Components only accept `className` for layout (margin, width, grid placement), never to
 * override their own colours or sizes, so no class-merging library is needed.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
