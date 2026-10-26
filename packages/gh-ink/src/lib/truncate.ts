/**
 * Shorten a string to `max` columns, eliding the MIDDLE rather than the tail.
 *
 * Shared rather than local because both row renderers measure against the same
 * budget arithmetic, and a second copy is a second place for the ellipsis rule
 * to drift.
 *
 * Drops the emoji presentation selector (U+FE0F) first. A text-default symbol
 * forced to emoji (`🏗️`, `♻️`) is two columns to Ink's measure but one in most
 * terminals, so every cell after it on the line lands a column left: the title
 * crowds its own emoji, and an overlay drawn across that line breaks its frame.
 * Without the selector both agree on one column.
 */
export const truncate = (input: string, max: number): string => {
  const str = input.replace(/️/g, "")
  if (str.length <= max) return str
  const half = Math.floor((max - 1) / 2)
  return `${str.slice(0, half)}…${str.slice(-half)}`
}
