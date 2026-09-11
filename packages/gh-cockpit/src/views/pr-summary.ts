import type { PrHealthData } from "@kud/gh"
import { filesOf, sizeOf, sizePartsOf } from "@kud/gh-workflow"

/**
 * The one-line answer to "what IS this pull request", drawn under the title and
 * above the tabs.
 *
 * A HEADER, not a tab, and the distinction is the whole design. A tab is a place
 * you go and do something — Health has `r`, `m`, `↵`; Conversation has `x`, `r`,
 * `R` — and a metadata tab would have no verbs at all. You would arrive, read six
 * words and press a key to leave, which is a modal built out of navigation. It
 * would also turn `←→` from a flip into a cycle, so the frequent path pays two
 * presses to serve the rare one.
 *
 * The deeper reason is when these facts are worth most: BEFORE you start reading
 * CI results, not after you go looking. "Oh, this is 900 lines" changes whether
 * you open it at all. Behind a tab it arrives too late to be that.
 *
 * Health is correctly scoped and loses nothing to this — CI, reviews and
 * mergeability all answer "is this blocked, does it want me". What was actually
 * wrong is that Health is the DEFAULT tab, so it had quietly become the
 * about-this-PR screen while having no idea what the PR is.
 */

/** Everything the line needs from the row itself, as `GHItem` supplies it. */
export type SummaryItem = {
  branch?: string
  author?: string
  age: string
  health?: string
}

const DIVIDER = " · "

/**
 * Size, additions green and deletions red — one colour per sign, on sign and
 * digits together.
 *
 * The string itself is `sizeOf` in `@kud/gh-workflow`, shared with the inbox
 * row so the two surfaces cannot drift; the invariants on its shape (`+` first,
 * ASCII hyphen, `null` while unmeasured) are documented there, and `sizePartsOf`
 * is the same string split for painting. Re-exported here so the view's own
 * test and any host still importing it from this module keep resolving. What
 * stays HERE is the colour ruling, because this is where the colour is applied.
 *
 * This has been ruled twice before, and the history is what stops it being
 * ruled a third time by accident. First "deliberately uncoloured"; then ONE
 * colour for the pair, the header's orange, on the argument that a hue per sign
 * hands a colourblind reader a near-identical pair and leaves the signs as the
 * only channel carrying anything. Both readings assumed colour was being asked
 * to tell `+412` from `-38`. It is not, and never was: the sign and the fixed
 * `+`-first order are the channels, and colour on top of them is reinforcement —
 * the precise contract `health-display.ts` applies to every health glyph, in
 * these same two tokens (`colors.success` for `✓`, `colors.error` for `✗`), so
 * red and green were on the row's hue budget throughout. Ruled 2026-09-11 with
 * the Designer, on Erwann's ask, and the cost she named still stands: two
 * coloured cells in a column that is not the decision. Small, because diffstat
 * colour is the most rehearsed convention in the tooling world and the eye reads
 * it as texture; not zero.
 *
 * Still bold and still leftmost (see `pr-view`), so the pair separates from the
 * dim provenance run on LUMINANCE and position as well as hue. Still no
 * magnitude banding: a colour that changes at 400 lines is a traffic light
 * needing a legend, and it puts a boundary between 399 and 401 while the digits
 * already say the size exactly.
 */
export { sizeOf, sizePartsOf }

/**
 * The line, in three tiers: the size, the file count, and the dim remainder.
 *
 * Split three ways rather than two because the flat run was the fault. Size is
 * the answer and takes the emphasis; the file count is the other half of "how
 * big" and sits one step down — plain and undimmed, grouped with the size by
 * contrast rather than by a divider; everything after it is provenance you look
 * at deliberately or not at all, and stays dim. Three cells rather than one
 * string, because only the renderer can express a tier.
 *
 * The draft marker leads the dim run, so on screen it follows the file count
 * rather than preceding it. It is still ahead of every fact it qualifies, and
 * it keeps the health vocabulary's own muted `~` — one glyph, one colour,
 * across screens, which is worth more than one line's emphasis.
 *
 * The rest, in a fixed order.
 *
 * Five facts survived the cut and everything else was ruled out. Labels are a
 * triage tool for the LIST — you filter by them, you do not read them once you
 * are inside — and their variable width would wreck a fixed row. Milestone,
 * assignees and project cards carry zero bits in a solo cockpit. The file LIST
 * is already a destination (`e` opens a picker that does it properly), so
 * duplicating it here competes with a better view. `updatedAt` is free and still
 * a no: two dates in one row means neither gets read, and staleness is the
 * inbox's question — by the time you have drilled in you have already decided to
 * look.
 *
 * The branch pair is the only elastic element, so it is the only one that gives
 * way. When the line will not fit, the HEAD branch is dropped and `→ base` kept:
 * under pressure, what am I merging INTO outranks what it is called. The numbers
 * are never truncated and the line never wraps.
 */
export const summaryOf = (
  item: SummaryItem,
  data: PrHealthData | null | undefined,
  cols: number,
): { size: string | null; files: string | null; rest: string } => {
  const size = data ? sizeOf(data) : null
  const files = data ? filesOf(data) : null
  const base = data?.baseRefName
  const author = item.author ? item.author : null
  const opened = item.age ? `opened ${item.age} ago` : null

  const branches = base
    ? item.branch
      ? `${item.branch} → ${base}`
      : `→ ${base}`
    : (item.branch ?? null)

  const parts = (branch: string | null) =>
    [branch, author, opened].filter((p): p is string => !!p)

  const full = parts(branches)
  const line = (ps: string[]) => ps.join(DIVIDER)
  const width = (ps: string[]) =>
    (size ? size.length + DIVIDER.length : 0) +
    (files ? files.length + DIVIDER.length : 0) +
    line(ps).length

  // A draft changes the meaning of everything in Health below it — "6 passed,
  // ready to merge" on a draft is a genuine misread — so it goes first, and as a
  // prefix rather than a column because it is rare: a cell that is usually empty
  // teaches you to skip past it.
  const draft = item.health === "draft"
  const prefix = draft ? `~ draft${DIVIDER}` : ""

  if (width(full) + prefix.length <= cols)
    return { size, files, rest: prefix + line(full) }
  const shortened = parts(base ? `→ ${base}` : null)
  return { size, files, rest: prefix + line(shortened) }
}
