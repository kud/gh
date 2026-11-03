import { colors } from "@kud/ink-ui"
import type { GHItem } from "@kud/gh-workflow"

/**
 * How heavy a PR is to review, as a tier from 0 (tiny) to 4 (huge).
 *
 * The heavier of two readings: lines touched (additions plus deletions) and
 * files touched. Either one alone lies in a known direction — a forty-file
 * rename is a handful of lines, and a one-file wall of SQL is one file — so the
 * tier takes whichever says "heavier".
 *
 * Except that a diff confined to one or two files never reaches huge, however
 * many lines it carries. That shape is almost always a lockfile, a vendored
 * SDK or a snapshot: thousands of lines nobody reads line by line. Capped at
 * large rather than ignored, because a reviewer still has to decide the vendor
 * drop is what it claims to be.
 *
 * `null` when the row never carried all three numbers — a PR nobody measured is
 * not a tiny PR, the same distinction `sizePartsOf` draws for `+0 -0`.
 */
export type WeightTier = 0 | 1 | 2 | 3 | 4

const LINE_CEILINGS = [10, 50, 250, 1000] as const
const FILE_CEILINGS = [2, 5, 15, 40] as const
const FEW_FILES = 2
const FEW_FILES_MAX_TIER: WeightTier = 3

const linesTierOf = (lines: number): WeightTier => {
  const i = LINE_CEILINGS.findIndex((ceiling) => lines < ceiling)
  return (i === -1 ? 4 : i) as WeightTier
}

const filesTierOf = (files: number): WeightTier => {
  const i = FILE_CEILINGS.findIndex((ceiling) => files <= ceiling)
  return (i === -1 ? 4 : i) as WeightTier
}

export const weightTierOf = (
  item: Pick<GHItem, "additions" | "deletions" | "changedFiles">,
): WeightTier | null => {
  const { additions, deletions, changedFiles } = item
  if (
    additions === undefined ||
    deletions === undefined ||
    changedFiles === undefined
  )
    return null
  const tier = Math.max(
    linesTierOf(additions + deletions),
    filesTierOf(changedFiles),
  ) as WeightTier
  return changedFiles <= FEW_FILES
    ? (Math.min(tier, FEW_FILES_MAX_TIER) as WeightTier)
    : tier
}

/** Cells in the meter, fixed so the size column beside it never moves. */
export const METER_COLS = 4

// A staircase rather than a bar of identical cells: lit cells rise by
// POSITION, so the silhouette itself grows with the weight and a reader who
// sees no colour still reads `▂▄▆█` as heavier than `▂▄▁▁`. Unlit cells sit on
// a flat `▁` baseline instead of a blank, so tier 0 still draws a floor and the
// four cells read as one instrument rather than as stray glyphs.
const LIT = ["▂", "▄", "▆", "█"] as const
const UNLIT = "▁"

export type MeterCell = { glyph: string; color: string }

/**
 * The meter's four cells for a tier, glyph and colour together.
 *
 * Lit cells in `secondary`, the middle neutral the row's labels and ages
 * already spend, and unlit ones in `muted`, a tier down — no new token on the
 * row. Huge is the one tier that earns a hue: every lit cell goes `warning`, so
 * the outlier is found without reading a digit, while the full staircase says
 * the same thing in shape for a colourblind reader.
 */
export const meterCellsOf = (tier: WeightTier): MeterCell[] => {
  const lit = tier === 4 ? colors.warning : colors.secondary
  return LIT.map((glyph, i) =>
    i < tier ? { glyph, color: lit } : { glyph: UNLIT, color: colors.muted },
  )
}
