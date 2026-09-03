import React from "react"
import { Box, Text } from "ink"

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
}

const ACCENT = "#FF8700"

/**
 * The rail's width, INCLUDING its rule and padding. Exported because the list
 * beside it has to shrink by exactly this much: every row in that list truncates
 * against a budget, and a budget that does not know the rail is there overflows
 * by the rail's whole width — which in a frame sized to fill the terminal
 * scrolls the panel rather than clipping a row.
 */
export const SIDEBAR_COLS = 40

// The rule that separates the rail from the list, and the breathing room after
// it. Both come out of the width above rather than being added to it, so a host
// subtracting SIDEBAR_COLS gets the whole cost in one number.
const RULE = 1
const PAD = 2
const CONTENT = SIDEBAR_COLS - RULE - PAD
// The label hangs under its key, so it starts two columns in and ends where
// everything else does.
const LABEL_INDENT = 2

// Matches the frame's own border rather than picking a second grey: two rules on
// one screen that differ by a shade read as a mistake, not as a hierarchy.
const RULE_COLOR = "gray"

/**
 * The dim figures after the key: how far through, and how much is moving.
 *
 * Either half may be missing and the other still worth saying, so this is a join
 * of what is known rather than one of three fixed shapes. `done`/`total` are
 * treated as a pair — a numerator with no denominator is not progress, it is a
 * number — and a zero is printed wherever it was counted, because "nothing is
 * moving" is exactly the thing a roadmap is read to notice.
 */
export const counts = (row: SidebarRow): string =>
  [
    row.done !== undefined && row.total !== undefined
      ? `${row.done}/${row.total}`
      : "",
    row.live !== undefined ? `${row.live} live` : "",
  ]
    .filter(Boolean)
    .join(" · ")

const truncate = (text: string, max: number): string =>
  [...text].length <= max
    ? text
    : [...text].slice(0, Math.max(0, max - 1)).join("") + "…"

/** Lines one row takes: the key line, the label beneath it, and the gap after. */
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

/**
 * A right-hand rail of initiatives, standing beside the list.
 *
 * Two lines per row rather than one, because both halves are load-bearing and
 * neither survives the other being cut: a key with no words cannot be read at a
 * glance, and words with no key cannot be opened. Forty columns is not enough for
 * both on one line, so they stack.
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
  return (
    // A rule down the left rather than a full box: the rail's other three edges
    // already have the frame's border a column or two away, and a second
    // rectangle inside the first reads as a nested panel — something you could
    // focus and act on, which this cannot be. One line is the whole claim: what
    // is left of it is the list, what is right of it is not.
    <Box
      flexDirection="column"
      width={SIDEBAR_COLS}
      flexShrink={0}
      height={height}
      borderStyle="single"
      borderColor={RULE_COLOR}
      borderDimColor
      borderTop={false}
      borderRight={false}
      borderBottom={false}
      paddingLeft={PAD}
    >
      <Box marginBottom={1}>
        <Text color={ACCENT} bold>
          {"» "}
        </Text>
        {/* A word, not a hue: which half of the screen the arrows drive is the
            one thing here you cannot afford to misread, and the same ● marker
            `Panel` uses for a focused pane would be invisible to anyone reading
            in monochrome. */}
        <Text bold>{sidebar.title}</Text>
        {focused ? <Text color={ACCENT}>{"  ● focus"}</Text> : null}
      </Box>
      {sidebar.rows.length === 0 ? (
        <Box paddingLeft={LABEL_INDENT}>
          <Text dimColor>nothing open</Text>
        </Box>
      ) : (
        shown.map((row, i) => {
          const active = focused && start + i === cursor
          return (
            <Box key={row.key} flexDirection="column" marginBottom={1}>
              <Box>
                {/* Two marks in two fixed cells, never one cell doing both jobs.
                  They answer different questions — `❯` is where YOU are, `←` is
                  what wants you — and a row can easily be both, which a shared
                  cell would have to resolve by hiding one of them. */}
                <Text color="cyan">{active ? "❯ " : "  "}</Text>
                {/* The same arrow the PR rows use for "your move", in the same
                  orange and the same fixed cell — a rail that invented its own
                  mark for the same question would make you learn the vocabulary
                  twice. Fixed width either way, so a row gaining or losing its
                  claim on you never shifts the key beside it. */}
                <Text color={ACCENT} bold>
                  {row.wantsYou ? "← " : "  "}
                </Text>
                <Text color={ACCENT} bold={active}>
                  {row.key}
                </Text>
                {/* Progress first, because it is the question a roadmap is
                    read to answer, and `live` second because it qualifies it:
                    4/9 says how far, 0 live says whether anything is moving,
                    and an initiative that is 4/9 with nothing live is the one
                    you most want to notice. Both are dim — the key is what you
                    act on. */}
                <Text dimColor>{`  ${counts(row)}`}</Text>
              </Box>
              <Box paddingLeft={LABEL_INDENT + 2}>
                <Text dimColor={!active}>
                  {truncate(row.label, CONTENT - LABEL_INDENT - 2)}
                </Text>
              </Box>
            </Box>
          )
        })
      )}
      {hidden > 0 ? (
        <Box paddingLeft={LABEL_INDENT}>
          <Text dimColor>{`+${hidden} more`}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
