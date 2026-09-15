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
 *
 * `defaultBranch` turns the arrow itself into the signal. A base that IS the
 * repo's default is the answer you already assumed, and drawing it spends a cell
 * on every PR to say nothing; a base that is not — `develop`, or a stacked
 * branch — is precisely the fact you can be wrong about and never notice,
 * because every other cell on this line reads identically either way. So the
 * base is drawn only when it differs, and the presence of `→` means look.
 *
 * It arrives as a parameter rather than on `SummaryItem` or `PrHealthData`
 * because it is neither: `SummaryItem` is what the ROW supplies and the row does
 * not know it, and `PrHealthData` is one `gh pr view` payload, which has no
 * default-branch field to carry (see `fetchDefaultBranch`). The host fetches it
 * per repo and hands it in.
 *
 * `undefined` means DRAW THE BASE, which is what a repo with no default branch
 * at all reports — so today's always-drawn behaviour is the fallback rather
 * than a special case. A lookup that FAILED does not arrive here as
 * `undefined`; `fetchDefaultBranch` throws so the caller's cache keeps its last
 * good answer, because a blip resolving to `undefined` would flicker a
 * suppressed cell back on.
 *
 * SUPPRESSION ALONE IS NOT ENOUGH, and the half that was nearly shipped without
 * is the half that does the work. Presence cannot fire from inside the dim tier:
 * `→ develop` wedged between two branch-shaped tokens, in a run already littered
 * with `·`, at identical luminance, gives the eye no reason to stop. So `base`
 * is returned as its own cell and drawn at the PLAIN tier while the head branch
 * stays dim — two channels, presence and luminance, both already in this
 * screen's vocabulary.
 *
 * NO HUE, deliberately, and this is the third colour ruling on this line so it
 * is written down rather than left to be rediscovered. `warning` says something
 * is wrong, and a PR onto `develop` on a repo with a develop flow is entirely
 * correct — merely notable. There is no "notable" token, and inventing one
 * spends a third channel on a fact two already carry. Colour is also the thing
 * a colourblind reader cannot use as the only signal, which presence and
 * luminance both survive.
 *
 * Why suppress at all, rather than always drawing it brighter: the draft note
 * above says a cell that is usually empty teaches you to skip past it. A cell
 * that is usually IDENTICAL teaches the same skip, faster. `→ main` on every
 * pull request is the most efficient way there is to train a reader out of
 * looking at that cell, so by the time it says `develop` they stopped weeks ago.
 * Always-shown-and-dim is not the neutral option; it manufactures the blindness.
 *
 * Named cells rather than a generic list of `{ text, tier }` pairs: five known
 * facts in a fixed order do not need a layout language, and `tier` as a value
 * would be rendering vocabulary leaking into a module that decides content. A
 * `null` cell means dropped or absent, which is also how the width ladder below
 * reports what it gave up.
 */
export type Summary = {
  size: string | null
  files: string | null
  /** `~ draft`, dim, leading the provenance run. */
  draft: string | null
  /** The head branch, dim. */
  head: string | null
  /** `→ base`, PLAIN — null whenever the base is the default. */
  base: string | null
  /** Author and age, dim. */
  trail: string | null
}

/** The cells in the fixed order the line draws them. */
export const SUMMARY_KEYS = [
  "size",
  "files",
  "draft",
  "head",
  "base",
  "trail",
] as const

/**
 * What separates a cell from the one actually before it — ` · ` everywhere,
 * except between the head branch and the base, which take a bare space.
 *
 * `fix/turn-arrow → develop` is one fact in two cells: the arrow is already the
 * separator, and a divider as well reads as a third item — `fix/turn-arrow · →
 * develop` — splitting a pair the eye has always read as one. Cells exist here
 * so the two can take different TIERS; that must not change what the line looks
 * like when both are drawn.
 *
 * It takes the PREVIOUS KEPT KEY rather than just its own, and that is the whole
 * subtlety. On a PR with no head branch recorded the base follows the file
 * count, and a bare space there glues the arrow onto the wrong fact —
 * `12 files → main`. The space is a property of the head/base PAIR, never of the
 * base alone.
 *
 * Exported because the width arithmetic here and the renderer in `pr-view` must
 * agree exactly: a line measured with one separator and drawn with another wraps
 * at a width nothing predicted.
 */
export const separatorBefore = (
  key: keyof Summary,
  previous: keyof Summary | null,
): string => (key === "base" && previous === "head" ? " " : DIVIDER)

/** The cells, in order, joined exactly as the renderer will draw them. */
export const joinCells = (cells: (string | null)[]): string => {
  let line = ""
  let previous: keyof Summary | null = null
  cells.forEach((cell, i) => {
    if (!cell) return
    const key = SUMMARY_KEYS[i]!
    line = line ? line + separatorBefore(key, previous) + cell : cell
    previous = key
  })
  return line
}

export const summaryOf = (
  item: SummaryItem,
  data: PrHealthData | null | undefined,
  cols: number,
  defaultBranch?: string,
): Summary => {
  const size = data ? sizeOf(data) : null
  const files = data ? filesOf(data) : null
  const baseRef = data?.baseRefName
  const author = item.author ? item.author : null
  const opened = item.age ? `opened ${item.age} ago` : null

  const showBase = baseRef !== undefined && baseRef !== defaultBranch
  const base = showBase ? `→ ${baseRef}` : null

  // A draft changes the meaning of everything in Health below it — "6 passed,
  // ready to merge" on a draft is a genuine misread — so it goes first, and as a
  // prefix rather than a column because it is rare: a cell that is usually empty
  // teaches you to skip past it.
  const draft = item.health === "draft" ? `~ draft` : null

  const trail =
    [author, opened].filter((p): p is string => !!p).join(DIVIDER) || null

  const widthOf = (cells: (string | null)[]) => joinCells(cells).length

  const full: Summary = {
    size,
    files,
    draft,
    head: item.branch ?? null,
    base,
    trail,
  }

  if (widthOf([size, files, draft, full.head, base, trail]) <= cols) return full

  // The one rung the ladder has ever had: the head branch goes and everything
  // else stays. It is still the only elastic cell — `→ base` now appears solely
  // when it is notable, so under pressure it outranks the name of what is being
  // merged, exactly as it did when the base was always drawn.
  //
  // Note this ladder is ONE step and always has been: if the remainder still
  // exceeds `cols`, the line wraps and the "never wraps" claim above fails.
  // That is true on a PR with no suppression anywhere near it, so it is not this
  // change's to fix — see the issue tracking the inverted ladder.
  return { ...full, head: null }
}
