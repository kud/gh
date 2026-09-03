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
  /** Something under it is waiting on you. */
  wantsYou?: boolean
}

export type Sidebar = {
  /** Heading for the rail. The host's vocabulary, never ours. */
  title: string
  rows: SidebarRow[]
}

const ACCENT = "#FF8700"

/**
 * The rail's width, INCLUDING its one-column gutter. Exported because the list
 * beside it has to shrink by exactly this much: every row in that list truncates
 * against a budget, and a budget that does not know the rail is there overflows
 * by the rail's whole width — which in a frame sized to fill the terminal
 * scrolls the panel rather than clipping a row.
 */
export const SIDEBAR_COLS = 30

const GUTTER = 1
const CONTENT = SIDEBAR_COLS - GUTTER

const truncate = (text: string, max: number): string =>
  [...text].length <= max
    ? text
    : [...text].slice(0, Math.max(0, max - 1)).join("") + "…"

/**
 * A right-hand rail of initiatives, standing beside the list.
 *
 * Two lines per row rather than one, because both halves are load-bearing and
 * neither survives the other being cut: a key with no words cannot be read at a
 * glance, and words with no key cannot be opened. Thirty columns is not enough
 * for both on one line, so they stack.
 *
 * Presentational, like every other row renderer here — it takes no keyboard and
 * holds no cursor. Whether the rail is shown at all is the host's state.
 */
export const SidePanel = ({
  sidebar,
  height,
}: {
  sidebar: Sidebar
  height?: number
}) => (
  <Box
    flexDirection="column"
    width={SIDEBAR_COLS}
    flexShrink={0}
    height={height}
  >
    <Box marginBottom={1} paddingLeft={GUTTER}>
      <Text color={ACCENT} bold>
        {"» "}
      </Text>
      <Text bold>{sidebar.title}</Text>
    </Box>
    {sidebar.rows.length === 0 ? (
      <Box paddingLeft={GUTTER + 2}>
        <Text dimColor>nothing open</Text>
      </Box>
    ) : (
      sidebar.rows.map((row) => (
        <Box key={row.key} flexDirection="column" marginBottom={1}>
          <Box paddingLeft={GUTTER}>
            {/* The same arrow the PR rows use for "your move", in the same
                orange and the same fixed cell — a rail that invented its own
                mark for the same question would make you learn the vocabulary
                twice. Fixed width either way, so a row gaining or losing its
                claim on you never shifts the key beside it. */}
            <Text color={ACCENT} bold>
              {row.wantsYou ? "← " : "  "}
            </Text>
            <Text color={ACCENT}>{row.key}</Text>
            {row.live !== undefined ? (
              <Text dimColor>{`  ${row.live} live`}</Text>
            ) : null}
          </Box>
          <Box paddingLeft={GUTTER + 2}>
            <Text dimColor>{truncate(row.label, CONTENT - 2)}</Text>
          </Box>
        </Box>
      ))
    )}
  </Box>
)
