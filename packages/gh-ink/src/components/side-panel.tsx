import React from "react"
import { Box, Text } from "ink"
import { colors, ProgressBar } from "@kud/ink-ui"

/**
 * One initiative in the rail — a container of work rather than a unit of it.
 *
 * Deliberately not a `TaskRow`. The list answers "what is in front of me today"
 * and prices every row by stage; this answers "what am I building, over months",
 * where a stage means nothing because an initiative's stage is only ever an
 * aggregate of its children's. Sharing a shape would have meant carrying a
 * `status` neither side agrees on.
 */
export type SidebarRow = {
  /** Stable identity, and the left column: a ticket key, an id, a slug. */
  key: string
  /** What it is, in words. Never omitted — a key alone cannot be read. */
  label: string
  /**
   * How much is moving under it right now. Absent draws nothing rather than a
   * zero: "no live work" and "we did not count" are different claims, and a
   * hard 0 asserts the first from evidence for neither.
   */
  live?: number
  /**
   * How far through it is — `done` of `total` children resolved.
   *
   * Both or neither, and only ever drawn together: a numerator with no
   * denominator is not progress, it is a number. Absent for the same reason
   * `live` is — a host that cannot count says nothing rather than claiming zero,
   * and the two counts genuinely can be unavailable while `live` is known, since
   * `live` is what the board already drew and this needs asking Jira again.
   */
  done?: number
  total?: number
  /** Something under it is waiting on you. */
  wantsYou?: boolean
  /**
   * Where ↵ takes you. Absent means the row is a label and nothing more — the
   * cursor still lands on it, and pressing ↵ does nothing rather than flashing
   * an error about a host decision the reader cannot change.
   */
  url?: string
}

export type Sidebar = {
  /** Heading for the rail. The host's vocabulary, never ours. */
  title: string
  rows: SidebarRow[]
  /**
   * What to call `live` on screen, in the host's words — `4 on board` and `off
   * board` on a ticket cockpit, say. Takes the number rather than a word pair
   * because the two states need not share a sentence shape: "off board" has no
   * N in it. `live` itself stays a number, so the absent-draws-nothing contract
   * and the host's sort are untouched.
   */
  liveLabel?: (live: number) => string
}

/**
 * The rail's width, INCLUDING its rule and padding. Exported because the list
 * beside it has to shrink by exactly this much: every row in that list truncates
 * against a budget, and a budget that does not know the rail is there overflows
 * by the rail's whole width — which in a frame sized to fill the terminal
 * scrolls the panel rather than clipping a row.
 *
 * Widened from 40 once the rail carried real initiative titles: at 40 the label
 * line had 33 columns to spend, which cut the summary of nearly every epic mid
 * word and left the rail listing keys with an ellipsis after them. The key line
 * was never the constraint — the label is what makes a key readable, and a rail
 * you cannot read is forty columns spent on nothing.
 */
export const SIDEBAR_COLS = 52

// The rule that separates the rail from the list, and the breathing room after
// it. Both come out of the width above rather than being added to it, so a host
// subtracting SIDEBAR_COLS gets the whole cost in one number.
const RULE = 1
const PAD = 2
const CONTENT = SIDEBAR_COLS - RULE - PAD

// The label line: two fixed marker cells, then the words. Two marks in two
// cells, never one cell doing both jobs — `❯` is where YOU are, `←` is what
// wants you, and a row can easily be both, which a shared cell would have to
// resolve by hiding one of them.
const MARKS = 4
const LABEL_COLS = CONTENT - MARKS

// The facts line hangs under the label at a fixed grid, so a row gaining or
// losing its bar never shifts the cell after it: key · bar · fraction · live.
// Two-space gutters throughout; the widths sum to CONTENT exactly.
const FACTS_INDENT = 6
const KEY_COLS = 10
const BAR_COLS = 10
const FRACTION_COLS = 5
const GUTTER = "  "
const LIVE_COLS =
  CONTENT -
  FACTS_INDENT -
  KEY_COLS -
  BAR_COLS -
  FRACTION_COLS -
  GUTTER.length * 3

/**
 * What `live` says when the host has no words of its own. Two states, both
 * bright and both in words: the sort already puts a dormant initiative last,
 * and dimming it would re-hide the thing the rail was built to show.
 */
const defaultLiveLabel = (live: number): string =>
  live === 0 ? "nothing live" : `${live} live`

/** `done/total`, or nothing — a numerator with no denominator is not progress. */
const fractionOf = (row: SidebarRow): string =>
  row.done !== undefined && row.total !== undefined
    ? `${row.done}/${row.total}`
    : ""

/**
 * The plain-text facts of a row, for a host or a test that wants them as one
 * string: how far through, then how much is moving. Either half may be missing
 * and the other still worth saying, and a zero is printed wherever it was
 * counted, because "nothing is moving" is exactly the thing a roadmap is read
 * to notice.
 */
export const counts = (
  row: SidebarRow,
  liveLabel: (live: number) => string = defaultLiveLabel,
): string =>
  [fractionOf(row), row.live !== undefined ? liveLabel(row.live) : ""]
    .filter(Boolean)
    .join(" · ")

// Punctuation a word-boundary cut can leave dangling — `batch (` reads as a
// typo where `batch…` reads as a cut.
const DANGLING = /[\s:;,.\-—–(\[{]+$/u

/**
 * Cut at a word boundary, with an ellipsis. A roadmap row needs to be
 * recognisable rather than complete — ↵ opens the epic — and a label cut mid
 * word (`frontend-royalti…`) makes the reader finish the word before they can
 * read the row. The boundary is only honoured while it keeps most of the
 * budget: a label whose first token is a thirty-character URL falls back to a
 * character cut rather than surrendering half the line to a space.
 */
export const truncateWords = (text: string, max: number): string => {
  const chars = [...text]
  if (chars.length <= max) return text
  const room = Math.max(0, max - 1)
  const hard = chars.slice(0, room).join("")
  // A cut that lands ON a space is already at a boundary: the word before it
  // is whole and keeps its place.
  const boundary = chars[room] === " " ? room : hard.lastIndexOf(" ")
  const soft =
    boundary >= Math.floor(room * 0.6) ? hard.slice(0, boundary) : hard
  return soft.replace(DANGLING, "") + "…"
}

/** Lines one row takes: the label, the facts beneath it, and the gap after. */
const ROW_LINES = 3
/** The title, and the blank line under it. */
const HEADING_LINES = 2

/**
 * How many rows fit in `height` — one fewer than would physically fit whenever
 * that means anything is left over, to buy the line that says so.
 *
 * Computed rather than left to the layout, because the layout's answer is to CUT,
 * silently. A roadmap quietly missing its last three initiatives looks exactly
 * like a roadmap that has none, and the whole reason the rail exists is that an
 * initiative with nothing moving on it was invisible.
 */
export const railCapacity = (height: number, rows: number): number => {
  const fits = Math.max(0, Math.floor((height - HEADING_LINES) / ROW_LINES))
  return fits >= rows ? rows : Math.max(0, fits - 1)
}

const percentOf = (done: number, total: number): number =>
  total === 0 ? 0 : Math.round((done / total) * 100)

// Progress as a shape beside its caption. The bar does the cross-row
// arithmetic the eye cannot do on `0/11` against `0/34`; the fraction carries
// what the bar hides, the denominator, and is the channel a test frame — or a
// monochrome terminal — can read, since `ProgressBar` tells fill from track by
// lightness alone. Grey rather than a hue: progress is a shape, not a verdict,
// and the row's one accent is the arrow.
const Progress = ({ row }: { row: SidebarRow }) => {
  const fraction = fractionOf(row)
  const bar =
    row.done !== undefined && row.total !== undefined && row.total > 0 ? (
      <ProgressBar
        value={percentOf(row.done, row.total)}
        width={BAR_COLS}
        color={colors.secondary}
      />
    ) : (
      <Text>{" ".repeat(BAR_COLS)}</Text>
    )
  return (
    <>
      {bar}
      <Text color={colors.secondary}>
        {GUTTER + fraction.padStart(FRACTION_COLS)}
      </Text>
    </>
  )
}

/**
 * A right-hand rail of initiatives, standing beside the list.
 *
 * Label first, facts beneath, because a roadmap is read by name: nobody thinks
 * "ACC-11312", they think "the OpenSearch migration". So the label is the
 * bright line and the key drops to the facts line as what it is — a reference
 * you follow, in the secondary tier. Two lines rather than one because both are
 * load-bearing and neither survives the other being cut: words with no key
 * cannot be opened, and a key with no words cannot be read at a glance.
 *
 * Presentational, like every other row renderer here: it DRAWS a cursor but does
 * not own one, and it never calls `useInput`. Where the cursor is, and whether
 * the arrows are pointed at this rail at all, are the host's state — which is
 * what lets a screen with two focus regions have exactly one of them lit.
 */
export const SidePanel = ({
  sidebar,
  height,
  focused = false,
  cursor = 0,
}: {
  sidebar: Sidebar
  height?: number
  /** The arrows are pointed here, so this rail draws the cursor. */
  focused?: boolean
  /** Which row the cursor is on. Only drawn while `focused`. */
  cursor?: number
}) => {
  const liveLabel = sidebar.liveLabel ?? defaultLiveLabel
  const capacity =
    height === undefined
      ? sidebar.rows.length
      : railCapacity(height, sidebar.rows.length)
  // Scroll the window rather than clamping the cursor at the last visible row:
  // a rail longer than its height is exactly the case where you need to reach
  // what is off the bottom, and stopping there would make those rows visible in
  // the `+N more` count and unreachable in the same breath.
  const start =
    focused && cursor >= capacity
      ? Math.min(cursor - capacity + 1, sidebar.rows.length - capacity)
      : 0
  const shown = sidebar.rows.slice(start, start + capacity)
  const hidden = sidebar.rows.length - shown.length
  // The heading is a section header, not the app's mark: bold, then the title
  // row's own dotted rule to the edge, which absorbs whatever the focus marker
  // adds or removes — so the region closes at the top without the box that
  // would read as a focusable nested panel.
  const focus = focused ? "  ● focus" : ""
  const rule = "╌".repeat(
    Math.max(0, CONTENT - [...sidebar.title].length - focus.length - 1),
  )
  return (
    // A rule down the left rather than a full box: the rail's other three edges
    // already have the frame's border a column or two away, and a second
    // rectangle inside the first reads as a nested panel — something you could
    // focus and act on, which this cannot be. One line is the whole claim: what
    // is left of it is the list, what is right of it is not. In the frame's own
    // colour and not dimmed, so the two rules read as one hierarchy.
    <Box
      flexDirection="column"
      width={SIDEBAR_COLS}
      flexShrink={0}
      height={height}
      borderStyle="single"
      borderColor={colors.muted}
      borderTop={false}
      borderRight={false}
      borderBottom={false}
      paddingLeft={PAD}
    >
      <Box marginBottom={1}>
        <Text bold>{sidebar.title}</Text>
        {/* A word, not a hue: which half of the screen the arrows drive is the
            one thing here you cannot afford to misread, and the same ● marker
            `Panel` uses for a focused pane would be invisible to anyone reading
            in monochrome. */}
        {focused ? <Text color={colors.accent}>{focus}</Text> : null}
        <Text color={colors.info} dimColor>{` ${rule}`}</Text>
      </Box>
      {sidebar.rows.length === 0 ? (
        <Box paddingLeft={MARKS}>
          <Text color={colors.muted}>nothing open</Text>
        </Box>
      ) : (
        shown.map((row, i) => {
          const active = focused && start + i === cursor
          return (
            <Box key={row.key} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={colors.info}>{active ? "❯ " : "  "}</Text>
                {/* The same arrow the PR rows use for "your move", in the same
                  orange and the same fixed cell — a rail that invented its own
                  mark for the same question would make you learn the vocabulary
                  twice. The one accent on the row, so it is also the loudest
                  thing in the column. */}
                <Text color={colors.accent} bold>
                  {row.wantsYou ? "← " : "  "}
                </Text>
                {/* The answer, so the brightest thing on the row; bold is the
                    cursor's, as `SelectableRow` does it. */}
                <Text bold={active}>
                  {truncateWords(row.label, LABEL_COLS)}
                </Text>
              </Box>
              <Box paddingLeft={FACTS_INDENT}>
                <Text color={colors.secondary}>
                  {row.key.padEnd(KEY_COLS) + GUTTER}
                </Text>
                <Progress row={row} />
                {/* The one bright figure on the facts line: it is what the rail
                    is sorted by, and it is the question "is this moving". */}
                <Text>
                  {GUTTER +
                    (row.live !== undefined
                      ? liveLabel(row.live).slice(0, LIVE_COLS)
                      : "")}
                </Text>
              </Box>
            </Box>
          )
        })
      )}
      {hidden > 0 ? (
        <Box paddingLeft={MARKS}>
          <Text color={colors.muted}>{`+${hidden} more`}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
