import { colors } from "@kud/ink-ui"
import type { Health } from "@kud/gh"

// The Ink layer's health vocabulary: map the surface-agnostic health token
// (decided once, in @kud/gh) to a glyph + an @kud/ink-ui colour. The GLYPH is
// what distinguishes states — kud is colourblind, so colour only reinforces and
// no two states share a glyph. Colours collapse onto ink-ui's palette (conflict
// and threads both take accent/orange but stay distinct by glyph).
export const healthDisplay: Record<Health, { glyph: string; color: string }> = {
  none: { glyph: " ", color: colors.muted },
  draft: { glyph: "~", color: colors.muted },
  "ci-fail": { glyph: "✗", color: colors.error },
  conflict: { glyph: "!", color: colors.accent },
  "changes-req": { glyph: "±", color: colors.warning },
  threads: { glyph: "◆", color: colors.accent },
  pending: { glyph: "*", color: colors.warning },
  approved: { glyph: "✓", color: colors.success },
  waiting: { glyph: "·", color: colors.muted },
  merged: { glyph: "»", color: colors.muted },
  closed: { glyph: "×", color: colors.muted },
}

export const healthGlyph = (h: Health): string => healthDisplay[h].glyph
export const healthColor = (h: Health): string => healthDisplay[h].color

// Human labels for the legend, actionable first and terminal states last. `none`
// (the blank no-status marker) is deliberately omitted.
export const healthLegend: [Health, string][] = [
  ["approved", "Approved · ready to merge"],
  ["pending", "Checks running"],
  ["ci-fail", "CI failing"],
  ["conflict", "Merge conflict"],
  ["changes-req", "Changes requested"],
  ["threads", "Open threads · your reply"],
  ["waiting", "Awaiting review"],
  ["draft", "Draft"],
  ["merged", "Merged"],
  ["closed", "Closed"],
]
