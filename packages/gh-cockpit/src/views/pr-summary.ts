import type { PrHealthData } from "@kud/gh"

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
 * Size, deliberately uncoloured.
 *
 * The trap here is subtler than "do not use red and green". Colour those two
 * numbers and a colourblind reader gets a near-identical pair of hues, leaving
 * the signs as the only channel that carries anything — so the colour has added
 * noise and taken nothing away, which is worse than plain text rather than
 * merely no better. The `+` and `-` are already doing all the work.
 *
 * `+` always before `-`, never reordered by magnitude, so position is a second
 * channel. ASCII hyphen rather than U+2212: this codebase holds a single-column
 * invariant on glyphs, `−` is ambiguous-width in some fonts, and `git diff
 * --stat` uses the hyphen anyway.
 */
export const sizeOf = (data: Pick<PrHealthData, "additions" | "deletions">) =>
  data.additions === undefined || data.deletions === undefined
    ? null
    : `+${data.additions} -${data.deletions}`

/**
 * The dim remainder, in a fixed order.
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
): { size: string | null; rest: string } => {
  const size = data ? sizeOf(data) : null
  const files =
    data?.changedFiles === undefined
      ? null
      : `${data.changedFiles} ${data.changedFiles === 1 ? "file" : "files"}`
  const base = data?.baseRefName
  const author = item.author ? item.author : null
  const opened = item.age ? `opened ${item.age} ago` : null

  const branches = base
    ? item.branch
      ? `${item.branch} → ${base}`
      : `→ ${base}`
    : (item.branch ?? null)

  const parts = (branch: string | null) =>
    [files, branch, author, opened].filter((p): p is string => !!p)

  const full = parts(branches)
  const line = (ps: string[]) => ps.join(DIVIDER)
  const width = (ps: string[]) =>
    (size ? size.length + DIVIDER.length : 0) + line(ps).length

  // A draft changes the meaning of everything in Health below it — "6 passed,
  // ready to merge" on a draft is a genuine misread — so it goes first, and as a
  // prefix rather than a column because it is rare: a cell that is usually empty
  // teaches you to skip past it.
  const draft = item.health === "draft"
  const prefix = draft ? `~ draft${DIVIDER}` : ""

  if (width(full) + prefix.length <= cols)
    return { size, rest: prefix + line(full) }
  const shortened = parts(base ? `→ ${base}` : null)
  return { size, rest: prefix + line(shortened) }
}
