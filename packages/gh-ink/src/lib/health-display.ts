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
  // The one glyph here that MEANS its state rather than merely differing from
  // the others. `✓` and `✗` you never have to think about; `»` you did — it was
  // chosen to suggest "moved through", which is a stretch nobody reads at a
  // glance. This is Nerd Font's git-merge icon, written as an escape because raw
  // PUA bytes get mangled by editors and diffs.
  //
  // The cost, stated rather than discovered: a terminal without a Nerd Font
  // draws a box here where it used to draw a chevron. That is a trade this
  // package has already made once — the inbox hardcodes the comment glyph at
  // \u{f086} — and one state degrading to tofu is cheaper than ten states none
  // of which say what they mean.
  merged: { glyph: "\u{e727}", color: colors.muted },
  // Nerd Font's closed-pull-request icon, for the same reason as `merged` above
  // and with the same caveat about a font that lacks it. `×` had a second problem
  // beyond being arbitrary: it is one stroke away from `✗` (ci failing) two rows
  // up in this very map, and the shape-distinctness this file turns on is a
  // silhouette test, not a codepoint one.
  closed: { glyph: "\u{ebda}", color: colors.muted },
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
