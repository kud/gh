/**
 * Shorten a string to `max` columns, eliding the MIDDLE rather than the tail.
 *
 * Shared rather than local because both row renderers measure against the same
 * budget arithmetic, and a second copy is a second place for the ellipsis rule
 * to drift.
 */
export const truncate = (str: string, max: number): string => {
  if (str.length <= max) return str
  const half = Math.floor((max - 1) / 2)
  return `${str.slice(0, half)}…${str.slice(-half)}`
}
