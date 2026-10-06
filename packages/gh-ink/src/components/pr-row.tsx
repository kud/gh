import React from "react"
import { Box } from "ink"
import { colors, Pill, pillWidth } from "@kud/ink-ui"
import {
  depthOf,
  impliedLabels,
  labelPriority,
  PIN_MARK,
  sizeOf,
  sizePartsOf,
  type GHItem,
} from "@kud/gh-workflow"
import { displayFor } from "../lib/health-display.js"
import { truncate } from "../lib/truncate.js"
import { Text, useBackdropped } from "../inbox/backdrop.js"
import type { FocusGutter } from "../inbox/focus-slot.js"

/**
 * How this row is moving through the list right now.
 *
 * The row itself never works this out: whoever owns the list owns the
 * choreography — what counts as an arrival, how long a departure is held, which
 * frame of a ramp is on screen — and hands the row the conclusion. So this
 * enumerates what the TITLE has to say, not what happened upstream to cause it.
 *
 * `withdrawn` is `departing` plus the strike: a row struck through is one that
 * has been taken off the list rather than moved along it, and the two read
 * differently on purpose.
 */
export type RowMotion = "arriving" | "departing" | "withdrawn"

/**
 * A solid pill at the end of the row, saying what just happened to it.
 *
 * Solid because it is an EVENT — `@kud/ink-ui`'s pill law in one line: the
 * column says where it sits, soft says what it is, solid says something
 * happened. The word and the colour are the caller's vocabulary; what the row
 * owns is that the pill is charged against the width budget whether or not it
 * is drawn.
 */
export type RowAnnouncement = { label: string; color: string }

export type PrRowProps = {
  item: GHItem
  active: boolean
  login?: string
  /**
   * The selection wash for this frame, resolved by the list — see
   * `selectionBackground` in the inbox. A prop rather than an import because
   * the constant lives next to the inbox's `OVERLAY_BG` and importing the inbox
   * here would cycle back through this module. Absent the row draws no wash.
   */
  selectionBg?: string
  /**
   * Columns available to this row, which is NOT always the frame width: a rail
   * beside the list takes its share, and a budget that does not know the rail is
   * there overflows by exactly the rail.
   */
  cols: number
  /** Overrides the health glyph — the inbox passes its transit/merge frame here. */
  icon?: { glyph: string; color: string }
  /**
   * This row's tree glyphs, already assembled — see `treePrefix`. Empty for a
   * top-level row.
   *
   * A row cannot work this out about itself: it is a fact about the rows BELOW
   * it (is a sibling still to come?) and about its ANCESTORS (does a stem still
   * need to run past this level?), so the list supplies it.
   */
  prefix?: string
  /**
   * Labels carried by EVERY label-bearing row in this section, measured once by
   * the list. Suppressed here for the same reason `impliedLabels` suppresses a
   * repo's conventional ones — a label on every row classifies nothing — but on
   * the section axis, which catches uniformity that comes from the query rather
   * than from a repo convention. Defaulted so a host that does not measure it
   * keeps exactly the behaviour it had.
   */
  uniformLabels?: readonly string[]
  /** How the title reads while the row is coming or going. Still when absent. */
  motion?: RowMotion
  /** In order, left to right. Charged against the width budget either way. */
  announcements?: readonly RowAnnouncement[]
  /**
   * The trailing columns' widths across the section — see `trailingColumnsOf`.
   * Absent, the row measures itself, which aligns nothing but draws the same
   * cells a host that never measured always got.
   */
  columns?: TrailingColumns
  /** Trailing columns the section has given up — see `sectionShedOf`. */
  shed?: TrailingShed
  /**
   * Width of the number cell across the section — see `numberColumnsOf`.
   * Absent, the row measures itself, which aligns nothing but never runs the
   * number into the title.
   */
  numberCols?: number
  /**
   * Whether the row draws its own `❯` gutter. A host that marks the selected
   * stop itself, in a column further left, passes `false` — otherwise the
   * selected row carries two cursors (`❯ ├─ ❯ …`). Hidden, the two columns go
   * to the title rather than standing empty.
   */
  gutter?: boolean
  /**
   * The focus gutter, resolved by the list — see `focusCellFor`. `undefined`
   * draws nothing at all (no focus feature, byte-identical to before); `null`
   * holds two blank columns so the marked row does not shift its neighbours;
   * a mark draws the focus glyph there in its colour. A fixed cell either way,
   * for the same reason the cursor gutter is one: a mark that moved the title
   * of exactly the row being watched would defeat its own purpose.
   */
  focusCell?: FocusGutter
}

// Unresolved review threads — a comment glyph (nf-fa-comments) + count, keeping
// to the single-glyph health vocabulary instead of spelling out "unresolved".
const threadsLabelOf = (item: GHItem): string =>
  item.unresolved > 0 ? `\u{f086} ${item.unresolved}` : ""

// `3h (2d)` — active 3h ago, open for 2d. Collapsed to one value when they
// agree, so an untouched row does not read as `2d (2d)`.
//
// PARENTHESES, NOT A DIVIDER, and the argument this replaces was wrong in a
// way worth recording. It ran: the left value is by construction the smaller
// of the two (nothing can be touched before it exists), and that invariant
// teaches the order without a legend, a colour or a second glyph column.
//
// It fails twice. Knowing which value is SMALLER is not knowing which value is
// WHICH — monotonicity establishes that an ordering exists and says nothing
// about what the two quantities are. And it only reads as ordered inside one
// unit: `0m · 1d` is obviously ordered, while `6d · 1w` needs weeks converted
// to days before the ordering is even visible. Cross-unit pairs are the COMMON
// case here rather than the edge, because GitHub ages cross units within a
// fortnight — so the one worked example that would teach the pattern is the
// one almost never on screen.
//
// A parenthetical is read as subordinate to the number beside it by every
// reader who has ever read anything, which kills the "two peers separated by a
// dot" reading that was causing the confusion: the bare value is THE age, the
// parenthetical is the lifetime. It costs nothing — `6d · 1w` and `6d (1w)`
// are both seven columns, so the budget below is unchanged — and it frees the
// `·` to mean one thing everywhere else on the row.
//
// Kept as a pair as well as a string: the string is what the width budget
// measures (one cell, one number of columns), the pair is what the renderer
// needs to paint the two halves at different tiers. Deriving the split back
// out of the string would mean parsing punctuation the line above just wrote.
const agePairOf = (item: GHItem) =>
  item.activityAge && item.activityAge !== item.age
    ? { activity: item.activityAge, lifetime: item.age }
    : null
const ageLabelOf = (item: GHItem): string => {
  const pair = agePairOf(item)
  return pair ? `${pair.activity} (${pair.lifetime})` : item.age
}

/**
 * The trailing block, in reading order: whose, how contested, how big, how
 * recent. Author leads because it is read as a column of names rather than
 * scanned per row; threads follow because they are the one cell that makes a
 * claim on you; age ends the row so every row ends on the date.
 *
 * Fixed columns rather than inline text: `by <login>` used to sit right after
 * the title, so its position floated with title length and finding one
 * author's rows meant reading each line. Aligned, the eye runs down a column
 * instead — the same move the 2026-09-30 alignment made for the other three.
 */
const TRAILING = ["author", "threads", "size", "age"] as const

/** Width of each trailing column, in terminal cells. Zero draws no column. */
export type TrailingColumns = Record<(typeof TRAILING)[number], number>

/** Which trailing columns a whole section has given up. */
export type TrailingShed = Partial<Record<(typeof TRAILING)[number], boolean>>

const cellsOf = (s: string) => [...s].length

// `@<login>`, capped at 16 cells including the `@`. Tail-truncated, not
// middle: a login is read left to right and its front is the discriminating
// part, where `truncate`'s middle elision exists for titles that carry their
// sense in both halves. Logins are ASCII on GitHub, so slice and cells agree.
const AUTHOR_CELL_MAX = 16
const authorLabelOf = (item: GHItem): string => {
  if (!item.author) return ""
  const full = `@${item.author}`
  return full.length <= AUTHOR_CELL_MAX
    ? full
    : `${full.slice(0, AUTHOR_CELL_MAX - 1)}…`
}

/**
 * The widest value each trailing column holds across these rows, measured once
 * by the list — the same move as `uniformLabels` and `markerCols`. It is what
 * makes the numbers line up: a column as wide as its widest value, right-
 * aligned, so digits sit under digits and the eye can run straight down it.
 * A column no row fills measures zero and is not drawn at all, which is what
 * keeps this from becoming GitHub's grid of `—`.
 *
 * Code points rather than `.length`: every value here is ASCII or a single
 * BMP glyph, so the two agree today, and a surrogate pair is the day they
 * would not.
 */
export const trailingColumnsOf = (items: readonly GHItem[]): TrailingColumns =>
  items.reduce(
    (w, item) => ({
      author: Math.max(w.author, cellsOf(authorLabelOf(item))),
      threads: Math.max(w.threads, cellsOf(threadsLabelOf(item))),
      size: Math.max(w.size, cellsOf(sizeOf(item) ?? "")),
      age: Math.max(w.age, cellsOf(ageLabelOf(item) ?? "")),
    }),
    { author: 0, threads: 0, size: 0, age: 0 } as TrailingColumns,
  )

/**
 * Width of the `#n` cell across these rows: the widest number plus a two-cell
 * gutter, left-aligned. The inbox measures it once over the rows of EVERY tab
 * (`listColumnsOf`), the same move as `markerCols` and `trailingColumnsOf`, so
 * the titles start on one column and that column moves neither as you scroll
 * nor as you switch tabs. Measured per tab, it put `#1234`'s titles a column
 * right of `#157`'s in the next tab, and every switch shifted the list.
 *
 * It replaced `padEnd(7)`, a constant that fitted the repos it was written
 * against and nothing else: `#31805` left a one-cell gutter where `#172` left
 * three, and a six-digit number would have run straight into its title.
 */
export const numberColumnsOf = (items: readonly GHItem[]): number =>
  items.reduce((w, item) => Math.max(w, cellsOf(`#${item.number}`)), 0) + 2

type LayoutInput = Pick<
  PrRowProps,
  | "item"
  | "login"
  | "cols"
  | "prefix"
  | "uniformLabels"
  | "announcements"
  | "columns"
  | "shed"
  | "numberCols"
  | "gutter"
> & {
  // Presence only, not the mark: every row holds the same two columns when a
  // focus is on screen, so the shed ladder — which drops trailing columns for
  // the whole section at once — needs the cost but not the occupant.
  focusGutter?: boolean
}

/**
 * Which trailing columns the section has to give up, so that every row gives up
 * the same ones. Each row is laid out alone and the drops are unioned: if any
 * row needs its size cell gone to keep a readable title, the size column goes
 * for all of them.
 *
 * Forcing a drop on a row that did not need it only ever hands that row more
 * room, so it can never push the row further down the ladder than it went on
 * its own — the union is stable in one pass.
 *
 * Announcements are left out on purpose. A MERGED pill lives for three seconds
 * on a row already leaving, and letting it reshape the whole section for those
 * three seconds would move every row under the one you just acted on.
 */
export const sectionShedOf = (
  rows: readonly Pick<LayoutInput, "item" | "prefix">[],
  context: Omit<LayoutInput, "item" | "prefix" | "announcements" | "shed">,
): TrailingShed =>
  rows.reduce<TrailingShed>((shed, row) => {
    const { givingUp } = layoutOf({ ...context, ...row })
    return {
      author: shed.author || givingUp.author,
      threads: shed.threads || givingUp.threads,
      size: shed.size || givingUp.size,
      age: shed.age || givingUp.age,
    }
  }, {})

/**
 * How one row spends its columns: which cells it draws, which it gives up, and
 * what is left for the title. Pure and outside the component so the LIST can run
 * it over a whole section too — see `sectionShedOf`, which is how the trailing
 * block drops a column for every row at once rather than one row at a time.
 */
export const layoutOf = ({
  item,
  login,
  cols,
  prefix = "",
  uniformLabels = [],
  announcements = [],
  columns,
  shed = {},
  numberCols,
  gutter = true,
  focusGutter = false,
}: LayoutInput) => {
  const numCols = numberCols ?? numberColumnsOf([item])
  const numStr = `#${item.number}`.padEnd(numCols)
  // Hide "by me" — the author column is only signal when it's someone else.
  // The width is still charged at the section's column below, blank on rows
  // that hide it: a hole in an aligned column reads as "none", and a tab
  // switch that moved every number would be the 2026-09-30 bug coming back.
  const showAuthor = !!item.author && item.author !== login
  const authorLabel = authorLabelOf(item)
  // `+18 -4`, on every PR row that carries it. It was gated on `showAuthor`
  // for one morning (2026-09-11) on the argument that you know the size of
  // your own — and Erwann overruled it the same afternoon: the number is how
  // a list of your own PRs is triaged too, and a cell that appears on the row
  // above and not on yours reads as a column that failed to fill. Absent, not
  // `+0 -0`, when the node never carried it.
  const sizeParts = sizePartsOf(item)
  const unresolvedLabel = threadsLabelOf(item)
  const agePair = agePairOf(item)
  const ageLabel = ageLabelOf(item)
  const own = columns ?? trailingColumnsOf([item])
  // Each announcement is a pill, so its label length alone under-prices it by
  // exactly its caps — see the ticket row's budget for the same correction.
  // Charged for every announcement handed in rather than for the one that will
  // actually be drawn: a budget that relies on only ever being given one stays
  // right for precisely as long as that invariant holds upstream, and this row
  // cannot see upstream.
  const pillCaps = announcements.length * 2
  // The boolean was doing two jobs here. This one is "this row hangs under
  // something, so say which repo it belongs to" — unchanged in meaning.
  const repoLabel = depthOf(item) > 0 ? item.repo : ""
  /*
   * At most two labels, best first by the host's ranking and by name after
   * that. Two because the cap is the whole design: a row that shows every label
   * has stopped being a row and become a paragraph, and the title is what it
   * came for.
   *
   * Sorted on a copy — `item.labels` is the caller's array and sorting in place
   * would reorder it under them.
   *
   * The repo's implied labels go first, before the rank and the slice: a label
   * every issue in the repo carries is the group header repeated, and a row
   * whose only label was implied draws no cell at all — a bare glyph would say
   * "classified" with no classification behind it. Filtered after the slice it
   * would take a slot and then vanish.
   */
  // Two axes of "says nothing", unioned: the repo's own convention, and
  // whatever this SECTION happens to make uniform. See `uniformLabels` above
  // for why the second exists — a `label:plan` view spanning five repos is
  // uniform by construction while only one of them is in the config.
  const implied = [...impliedLabels(item.repo), ...uniformLabels]
  const labelNames = (item.labels ?? [])
    .filter((l) => !implied.includes(l))
    .sort((a, b) => labelPriority(a) - labelPriority(b) || a.localeCompare(b))
    .slice(0, 2)

  /*
   * Everything after the title is CONTEXT, and context that costs you the thing
   * it contextualises is a bad trade — so when the row cannot have it all, the
   * trailing furniture is given up in order rather than the title being floored.
   *
   * The floor was the bug. `Math.max(20, cols - fixedWidth)` is fine while the
   * frame is wide and fatal the moment something takes forty columns away: a PR
   * carrying a long repo name and two ages has nothing left, takes the floor
   * anyway, and overflows by exactly the difference. Ink's answer to an
   * overflowing row is not to clip it but to compress every flexible child in it,
   * so the key, the number and the title all shrink together and wrap into a
   * column of fragments — the list stops looking like a list, and anything beside
   * it is pushed off the screen. One row too wide takes the whole frame with it.
   *
   * Order is least-valuable-first, and the two announcements are absent from it:
   * MERGED and the transit labels are the news the row exists to carry that
   * moment, and a row that drops its own headline to keep a repo name has the
   * priority exactly backwards.
   */
  // `labels` is a COUNT, not a flag — how many of the (at most two) label names
  // have been given up. It is the one participant that appears on two rungs of
  // the ladder below, because the two labels are not worth the same: the second
  // is speculative, the first is what the row IS. So it degrades two → one →
  // none rather than vanishing whole.
  //
  // The three trailing columns start from what the SECTION has already given up
  // (`shed`), so a column the list dropped for one row is dropped for all of
  // them — a hole in an aligned column reads as "none", which is a lie.
  const givingUp = {
    author: !!shed.author,
    size: !!shed.size,
    threads: !!shed.threads,
    age: !!shed.age,
    repo: false,
    labels: 0,
  }
  /*
   * `\u{f02b}` (nf-fa-tag) then the names, comma-separated — the same
   * glyph-then-content shape `\u{f086} 2` already uses for unresolved threads,
   * so the vocabulary is learned once. Not a Pill: a pill is drawn filled and
   * means "the row belongs to this category", and two filled pills on the most
   * contended row in the app out-shout the health glyph and the title both.
   *
   * 24 columns for the names is a design cap, not a width fallback — it holds on
   * a 200-column frame too, because past it the cell stops being a marker and
   * becomes a second title. Whole labels only: a clipped classification is a lie
   * you cannot check, since `stat…` could be `status:blocked` or `status:done`,
   * where a clipped title still carries its sense. The one exception is a lone
   * first label longer than the cap, which is truncated rather than dropped —
   * a clipped label still says the row is classified, and nothing says it isn't.
   *
   * Math.max around the subtraction because `slice(0, -1)` drops from the TAIL:
   * a single-label row on the second rung would otherwise keep the very label it
   * was told to give up.
   */
  const LABEL_CELL_MAX = 24
  const labelCell = () => {
    const shown = labelNames.slice(
      0,
      Math.max(0, labelNames.length - givingUp.labels),
    )
    if (shown.length === 0) return ""
    const fitted: string[] = []
    for (const name of shown) {
      const next = [...fitted, name].join(", ")
      if (next.length <= LABEL_CELL_MAX) fitted.push(name)
    }
    if (fitted.length === 0) {
      return `\u{f02b} ${truncate(shown[0], LABEL_CELL_MAX)}`
    }
    return `\u{f02b} ${fitted.join(", ")}`
  }
  const widthOf = () => {
    // The trailing block is charged at the SECTION's column widths, not at this
    // row's own values: a row with no threads still pays for the column, because
    // the column is drawn on it too — blank, which is how absence reads here.
    // The author is one of those columns now, not a per-row suffix after the
    // title: its width moves neither with title length nor with whose row it is.
    const block = TRAILING.reduce(
      (w, k) => (givingUp[k] || own[k] === 0 ? w : w + 2 + own[k]),
      0,
    )
    const pills = announcements.reduce((w, a) => w + 2 + a.label.length, 0)
    // Charged apart from the block because it sits BETWEEN the title and the
    // repo, not in the trailing group — same as repoLabel.
    //
    // The cell's own string counts its glyph as one character; it is charged as
    // two. `\u{f02b}` is a PUA codepoint and this file's turn-arrow comment
    // above already records that PUA can render double-width in some fonts.
    // Tolerable here for exactly the reason it was not there: this cell sits
    // right of the title, so a double-width render shifts trailing furniture
    // rather than the aligned zone. But under-charge it by one and every row
    // carrying a label overflows by one in those fonts — which is the class of
    // bug this whole block exists to prevent. Two leading spaces, then the cell,
    // then the glyph's second column.
    const cell = labelCell()
    return (
      (gutter ? 2 : 0) +
      prefix.length +
      (focusGutter ? 2 : 0) +
      2 /* health */ +
      2 /* turn */ +
      numCols +
      (cell ? 2 + cell.length + 1 : 0) +
      (givingUp.repo ? 0 : repoLabel.length) +
      block +
      pills +
      pillCaps +
      4
    )
  }
  // Short enough to still say something, long enough to be worth reading. Below
  // this the row is better off shedding its context than its subject.
  const MIN_TITLE = 24
  //
  // The label cell takes two of these rungs. The second label goes early — it is
  // the most speculative thing on the row — and the first outlives both the
  // thread count and the repo, because by then the row is down to what it IS.
  //
  // Assignment rather than `+= 1`, so each rung states the resulting count
  // outright and reordering this array cannot silently produce the wrong one.
  //
  // Size outlives the author — on a review queue `@X` is the least
  // discriminating thing on the row — and the speculative second label, and
  // dies before the thread count: a thread is a claim on you NOW, a size is an
  // aid to deciding WHETHER to engage, and the PR header still holds it.
  for (const give of [
    () => (givingUp.author = true),
    () => (givingUp.labels = 1),
    () => (givingUp.size = true),
    () => (givingUp.threads = true),
    () => (givingUp.labels = 2),
    () => (givingUp.repo = true),
    () => (givingUp.age = true),
  ]) {
    if (cols - widthOf() >= MIN_TITLE) break
    give()
  }
  const labelLabel = labelCell()
  // Never below 1: with everything given up the row is as short as it can be, and
  // a negative budget would hand `truncate` nonsense. A frame that narrow has
  // bigger problems than this row.
  const titleMax = Math.max(1, cols - widthOf())
  return {
    numStr,
    showAuthor,
    authorLabel,
    sizeParts,
    unresolvedLabel,
    agePair,
    ageLabel,
    repoLabel,
    givingUp,
    labelLabel,
    titleMax,
    columns: own,
  }
}

/**
 * One pull request or issue, as a single line of a list.
 *
 * The shared renderer: the inbox draws its rows with it, and so does anything
 * else that has a `GHItem` and a width. Everything it knows is in its props —
 * it holds no timers, reads no clock, and has no opinion about whether the list
 * is refreshing. That is deliberate and it is the seam: the choreography of
 * arrival, merge and departure belongs to whoever owns the list, and reaches
 * the row as `icon`, `motion` and `announcements` after the decisions are made.
 */
export const PrRow = ({
  item,
  active,
  login,
  cols,
  selectionBg,
  icon: iconOverride,
  prefix = "",
  uniformLabels = [],
  motion,
  announcements = [],
  columns,
  shed,
  numberCols,
  gutter = true,
  focusCell,
}: PrRowProps) => {
  // Read once for the row rather than at each of the pill sites — a hook, so it
  // cannot sit inside a branch.
  const backdropped = useBackdropped()
  const { glyph: healthIcon, color: healthColor } = displayFor(item.health)
  // An override REPLACES the health glyph rather than sitting beside it: this
  // column is one cell wide and every row's title is aligned off it, so a second
  // glyph here would shift the title of exactly the row being watched — which is
  // invariably the row something is happening to. One cell, one occupant, and
  // the caller decides which.
  //
  // Glyph and colour travel together and are taken together, never mixed. A
  // caller that wants the health glyph in a different colour says so by handing
  // the health glyph back, which keeps this line free of a third state where
  // half the cell is overridden.
  const { glyph: icon, color } = iconOverride ?? {
    glyph: healthIcon,
    color: healthColor,
  }
  // Whose turn it is, in its own fixed cell. Arrows rather than the nerd-font
  // comment glyph because this column sits in the aligned zone left of the
  // title: a PUA codepoint that renders double-width in some fonts would shift
  // only the rows that carry one, and a fixed cell exists precisely so the
  // title never moves. ← and → are already proven in this UI's footer hints.
  const spokeLast = !!login && !!item.lastActor && item.lastActor === login
  // A pinned row lands in Your move for a reason no arrow can carry: the arrows
  // report who SPOKE last, and a pin is not a turn in the conversation. Left to
  // the arrow alone it would sit under Your move wearing a grey → that says the
  // opposite. So it gets its own mark, single-width ASCII because this cell is
  // in the aligned zone where a codepoint that renders double-width anywhere
  // would shift only the rows carrying one.
  //
  // NOT `!`, which was the first choice and was wrong: `!` is `conflict` in the
  // health vocabulary, in this same orange, one cell to the left — so a PR that
  // was both rendered `! !` twice in the same colour with nothing to tell the
  // two apart. The colourblind invariant health-display.ts states for its own
  // map has to hold ACROSS the adjacent cells too, not just within one, and
  // `pinMarkIsUnambiguous` in health-display.test.ts now pins that.
  // `→` IS A BLANK, and that is a silhouette ruling rather than a tidy-up.
  //
  // The cursor is `❯` at column 0 and this cell sits at column 4 on a top-level
  // row. Both were small rightward points, so at scan speed — when the eye is
  // asking "which row am I on" — a rightward mark four columns in, present on
  // some rows and not others, was a second candidate answer to that question.
  // The collision is not that two marks are close; it is that they POINT THE
  // SAME WAY while only one of them is on every row.
  //
  // Substituting another rightward glyph (`▸`, `›`, `»`) patches the symptom and
  // lands on a different neighbour — `▸` beside `◆` is two filled blobs in
  // adjacent cells. Blanking separates by DIRECTION, which is a shape channel
  // and therefore survives the colourblind invariant that a hue swap would not.
  // `←` points left; nothing else on the row is a horizontal arrow (not the
  // health map, the transit frames, the merge sparkle, `\u{f086}` or
  // `\u{f02b}`), and the tree run `└─` is furniture two tiers down.
  //
  // Nothing is lost that this cell was carrying. `→` said "you spoke last,
  // nothing is being asked of you" — the ABSENCE of a claim, and absence already
  // draws as a blank here (`none` health is `" "`). The band header says it in
  // words, the thread cell is already quiet on `spokeLast`, and the explain
  // action has room for a sentence. What it buys is a sparse column whose only
  // ink is `←`, the one state that is a claim on you.
  //
  // The accepted cost: "you spoke last" and "we never learned who spoke" now
  // draw alike. The second is a FETCH fact rather than a domain one — the same
  // distinction `UNREAD_DISPLAY` makes — and neither is actionable, so it is not
  // worth a column in the aligned zone.
  const [turnIcon, turnColor] = item.pinned
    ? [PIN_MARK, colors.accent]
    : !login || !item.lastActor || spokeLast
      ? [" ", colors.muted]
      : ["←", colors.accent]
  const {
    numStr,
    showAuthor,
    authorLabel,
    sizeParts,
    unresolvedLabel,
    agePair,
    ageLabel,
    repoLabel,
    givingUp,
    labelLabel,
    titleMax,
    columns: block,
  } = layoutOf({
    item,
    login,
    cols,
    prefix,
    uniformLabels,
    announcements,
    columns,
    shed,
    numberCols,
    gutter,
    focusGutter: focusCell !== undefined,
  })

  return (
    // The wash paints every cell of the fixed-width row — an Ink Box's
    // background covers its full measure, not just the inked cells.
    <Box width={cols} backgroundColor={selectionBg}>
      {gutter ? <Text color={colors.info}>{active ? "❯ " : "  "}</Text> : null}
      <Text dimColor>{prefix}</Text>
      {/* The focus gutter, right after the tree run and before the row's own
          cells: the eye learns one place for it, and a fixed cell means the
          mark never moves the title it is pointing at. Absent entirely without
          a focus, so a host that never wired one draws byte-identical rows. */}
      {focusCell !== undefined ? (
        focusCell ? (
          <Text color={focusCell.color} bold>{`${focusCell.mark} `}</Text>
        ) : (
          <Text>{"  "}</Text>
        )
      ) : null}
      <Text color={color as any} bold>
        {icon + " "}
      </Text>
      <Text color={turnColor as any} bold={turnIcon === "←"}>
        {turnIcon + " "}
      </Text>
      <Text color={colors.accent}>{numStr}</Text>
      {/* Three channels, one per state, and none of them colour: bold for a row
          coalescing into the list, dim for one on its way out, and the strike on
          top of the dim for one struck off it entirely. Shape and weight rather
          than hue, so the distinction survives a colourblind reader and a piped
          frame alike. */}
      <Text
        bold={active || motion === "arriving"}
        dimColor={motion === "departing" || motion === "withdrawn"}
        strikethrough={motion === "withdrawn"}
      >
        {/* On a needs-you tab the row answers "what must be decided" rather than
            "what is it called": the host's one plain line replaces the title in
            the same cell, same truncation, same styling — `titleMax` is a width,
            not a measure of the title, so the budget holds either way. A row
            with an empty decision draws its title as before rather than a
            blank. */}
        {truncate(
          item.needsYou?.decision ? item.needsYou.decision : item.title,
          titleMax,
        ) + "  "}
      </Text>
      {/* Straight after the title and before the repo, not out in the trailing
          furniture: a label says what the row IS, so it is read as part of the
          subject rather than scanned down a column — which is why `age` is
          pinned right and this is not. Hueless on purpose, and one tier above the
          furniture: `dimColor` is what the age renders in, and a middle tier
          drawn in the bottom one is not quiet, it is absent — the labels were
          measured at the same L* as the age and read as noise. `secondary` is
          the same tone the turn arrow and the answered thread count wear, so
          the row has three neutrals and no more. GitHub's own
          per-label colour is authored in a repo with no knowledge of this
          palette, and it would be the one place on the row where hue alone did
          the discriminating, which is the failure health-display.ts exists to
          prevent. Casing is verbatim: the string is what you would type back
          into `gh --label`, and uppercase is already claimed here by the pills,
          which are announcements rather than standing classifications. */}
      {labelLabel ? (
        <Text color={colors.secondary}>{labelLabel + "  "}</Text>
      ) : null}
      {repoLabel && !givingUp.repo ? <Text dimColor>{repoLabel}</Text> : null}
      {/* THE TRAILING BLOCK, pinned to the right edge: author, threads, size,
          age, each in a column as wide as the section's widest value. Before
          2026-09-30 these cells ran straight on from the title, so they started
          somewhere different on every row and finding "which PR has threads"
          meant reading each line. Aligned, the eye runs down a column instead.
          The author lived inline after the title (`by <login>`) until its own
          column, floating with title length for the same reason — one author's
          rows could not be run down either.

          Box widths rather than padStart: padStart counts UTF-16 units, Ink lays
          out in terminal cells, and the Box is sized by the same measure Ink
          draws with. flexShrink={0} because a shrinkable cell is the first thing
          Ink compresses when a row overflows, and a squeezed column is not a
          column. A row with nothing for a column still draws it — blank, the
          way absence reads everywhere on this row — so the columns stay
          aligned. */}
      <Box flexGrow={1} />
      {/* First of the trailing columns, so every author's rows can be run down
          one edge rather than found after each title. `@login`, no "by": the
          sigil is the channel a colourblind reader and a piped frame share, and
          `secondary` is the middle neutral the label cell and the answered
          thread count already spend — no new token, no hue, no italic. Left-
          aligned inside its column so the sigils line up; blank on the viewer's
          own rows, which is how absence reads everywhere else on this row. */}
      {block.author > 0 && !givingUp.author ? (
        <Box marginLeft={2} width={block.author} flexShrink={0}>
          {showAuthor ? (
            <Text color={colors.secondary}>{authorLabel}</Text>
          ) : null}
        </Box>
      ) : null}
      {/* Follows the turn arrow, because an unresolved thread is not by itself
          a claim on you: GitHub keeps a thread open until someone clicks
          Resolve conversation, so replying leaves the count exactly where it
          was. Loud while the other side spoke last, quiet once you have
          answered — otherwise this cell reads "your turn" in orange one column
          from the arrow reading "not your turn" in grey. Never dimmed on an
          unknown turn (no login, no lastActor): a count we cannot attribute is
          still worth seeing. */}
      {block.threads > 0 && !givingUp.threads ? (
        <Box
          marginLeft={2}
          width={block.threads}
          justifyContent="flex-end"
          flexShrink={0}
        >
          {unresolvedLabel ? (
            <Text
              bold={!spokeLast}
              color={spokeLast ? colors.secondary : colors.accent}
            >
              {unresolvedLabel}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {/* Additions in `colors.success`,
          deletions in `colors.error` — the same two tokens health-display.ts
          spends on `✓` and `✗`, so no hue is new to the row — each painted on
          sign and digits together, the shape git and GitHub already taught.
          No bold (the cursor's), no dim, no banding by magnitude: a colour
          that flips at 400 lines is a traffic light needing a legend, and width
          already carries size — `+2140 -388` is longer than `+6 -1` before
          anyone reads a digit.

          This cell was plain until 2026-09-11, on the argument that a hue per
          sign hands a colourblind reader two near-identical hues. That argument
          assumed colour was doing the discriminating. It is not: the `+`/`-`
          sign and the fixed `+`-first order are the channels, and colour only
          echoes them — the exact contract health-display.ts is built on, and
          the one it had been applying to every health glyph on the same row all
          along. Keep the signs; the colour is not licensed to replace them.
          Same treatment as the PR header's, one register down. One caveat, for
          the reader rather than the UI: GitHub counts lockfiles and generated
          files, so a six-line change that bumps `package-lock.json` reads as
          large. The number is honest about what the diff view will show; it is
          not a proxy for thought required. */}
      {block.size > 0 && !givingUp.size ? (
        <Box
          marginLeft={2}
          width={block.size}
          justifyContent="flex-end"
          flexShrink={0}
        >
          {sizeParts ? (
            <Text>
              <Text color={colors.added}>{sizeParts.added}</Text>{" "}
              <Text color={colors.removed}>{sizeParts.removed}</Text>
            </Text>
          ) : null}
        </Box>
      ) : null}
      {/* Age last, so every row ends on the date. Left-aligned inside its column,
          unlike the two numbers: the activity value is what you scan for, so
          it is the part that lines up, and the lifetime trails after it.
          Two tiers inside one cell, because the two halves are not equally
          worth reading: last-activity is the live fact you scan for, lifetime is
          background you consult. Painting both `dimColor` said "skip all of
          this" about the half you came here for. Last-activity takes
          `secondary` — the middle neutral the label cell already spends, no new
          token and no hue — and the parenthetical stays in the furniture tier.
          The parentheses carry the meaning on their own for a reader who sees no
          colour at all; the tier only reinforces them. */}
      {block.age > 0 && !givingUp.age ? (
        <Box marginLeft={2} width={block.age} flexShrink={0}>
          {agePair ? (
            <Text>
              <Text color={colors.secondary}>{agePair.activity}</Text>
              <Text dimColor>{` (${agePair.lifetime})`}</Text>
            </Text>
          ) : ageLabel ? (
            <Text color={colors.secondary}>{ageLabel}</Text>
          ) : null}
        </Box>
      ) : null}
      {/* Except for the three seconds a row is on its way out. */}
      {/* Suppressed behind an overlay — see the task row for why a pill cannot
          simply be recoloured with the rest of the backdrop. Suppressed in the
          render only: `pillCaps` above charges for it either way, because a row
          that reflowed as the overlay opened would move under the panel that
          just appeared over it. */}
      {backdropped
        ? null
        : announcements.map((a) => (
            <React.Fragment key={a.label}>
              <Text>{"  "}</Text>
              <Pill color={a.color}>{a.label}</Pill>
            </React.Fragment>
          ))}
      {/* See the ticket row: the refresh wording lives in the header now, not
          here, because here it costs columns the row does not have. MERGED above
          stays — it is your own action a second ago, on a row that is leaving
          anyway, so its reflow is both expected and brief. */}
    </Box>
  )
}
