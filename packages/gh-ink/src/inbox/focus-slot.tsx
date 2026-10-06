import React from "react"
import { Box, Text } from "ink"
import { colors } from "@kud/ink-ui"
import { truncate } from "../lib/truncate.js"

/**
 * The one thing the reader should look at next, in the host's words.
 *
 * Data, not vocabulary: `label` is the host's word for the row ("focus"), but
 * everything else arrived over the wire — which ticket, what it says, where it
 * lives — and goes stale the same way the rows do. That is why it rides the
 * fetch result (and the cache beside the rows) rather than arriving as props.
 *
 * `undefined` (the field absent) means the host has no focus feature and draws
 * no row at all; `null` means there is one and it currently has nothing to
 * point at, which draws the dim empty line. The distinction matters because a
 * host that never wired the feature must keep byte-identical output, while a
 * host whose feature came back empty still owes the reader one line saying so.
 */
export type FocusSlot = {
  /** The mark in front of the row, accent by default. */
  mark?: string
  /** The mark's colour. Defaults to the accent. */
  markColor?: string
  /** What the row is a slot OF, in the host's words: `focus`, say. */
  label: string
  /** The thing to look at: a ticket key, or a PR-style `#427`. */
  ref: string
  /** The ref's colour. A `#` ref takes the accent, anything else the ticket. */
  refColor?: string
  /** The row's own title, bold. Truncated to keep the line to one row. */
  title: string
  /** Why this is the focus, dim, three spaces after the title. */
  reason: string
  /** The host's priority glyph for the row, drawn in the default foreground. */
  marker?: string
  /** Where `g` goes: the tab id and the row url. */
  target: { tab: string; url: string }
}

// nf-md-target, written as a supplementary-plane escape: raw PUA bytes get
// mangled by editors and diffs — the same reason the strip's marks are
// escapes — and `\uXXXX` cannot spell past the BMP, so this takes the braced
// form. A target rather than an arrow: nothing else on the row points
// anywhere, and the turn cell's `←` already answers a different question one
// screen below.
export const FOCUS_MARK = "\u{F04FE}"

// The inbox key that jumps to the focus row, drawn as a quiet hint after the
// reason on the ready row. One constant so the keymap legend, the input
// handler and the hint cannot drift: a key renamed in one place and forgotten
// in another would either advertise a jump that does nothing or hide one that
// works, and all three read this.
export const FOCUS_JUMP_KEY = "g"

export const DEFAULT_FOCUS_LABEL = "focus"
export const DEFAULT_FOCUS_EMPTY = "nothing to focus on"

/**
 * What one row draws in the focus gutter, resolved by the list. `undefined`
 * means no focus is on screen and the row draws nothing — the branch is
 * absent, not blank, so output without the feature is byte-identical. `null`
 * holds two blank columns on a row the focus is not pointing at, so the one
 * row that carries the mark does not shift its neighbours.
 */
export type FocusGutter = { mark: string; color?: string } | null

/**
 * The gutter cell for a row url: the mark when this is the row `g` would land
 * on, a blank holder on every other row while a focus is on screen, nothing at
 * all without one. One function so the task rows and the PR rows cannot
 * disagree about which row is marked.
 */
export const focusCellFor = (
  focus: FocusSlot | null | undefined,
  url: string | undefined,
): FocusGutter | undefined => {
  if (focus === undefined) return undefined
  if (!focus || url !== focus.target.url) return null
  return { mark: focus.mark ?? FOCUS_MARK, color: focus.markColor ?? colors.accent }
}

/**
 * The ref's colour, for the one decision the frame cannot show. A `#427` is a
 * pull request and takes the accent — the same orange the PR rows number
 * themselves in — while a ticket key takes the ticket yellow. An explicit
 * `refColor` wins over both, for a host whose refs follow another vocabulary.
 *
 * Exported pure because the test frame carries no escape codes: a colour that
 * lived only in a tint would be a colour nobody can test for.
 */
export const focusRefColor = (
  focus: Pick<FocusSlot, "ref" | "refColor">,
): string =>
  focus.refColor ?? (focus.ref.startsWith("#") ? colors.accent : colors.ticket)

const cells = (s: string): number => [...s].length

// The title's share of the row, priced the way the PR rows price theirs: every
// fixed cell first, whatever is left for the words. The title gives way before
// the reason because it is the longer of the two by construction, and a reason
// clipped to nothing would leave the row pointing without saying why.
//
// The jump hint is priced with the fixed cells, but it is spent last: when
// space runs short the title truncates first, then the reason truncates
// around a hint that stays, and only when the reason would fall below one
// cell does the hint drop and hand its cells back to the reason. A hint beside
// an empty reason would advertise a key on a row that says nothing, while a
// reason clipped to nothing beside a hint would say nothing at all.
const titleBudgetOf = (
  focus: FocusSlot,
  label: string,
  width: number,
  jumpKey?: string,
): { title: string; reason: string; hint: string | undefined } => {
  const hint = jumpKey ? jumpKey : undefined
  const mark = focus.mark ?? FOCUS_MARK
  const head =
    2 /* gutter */ +
    cells(mark) +
    1 +
    cells(label) +
    2 +
    (focus.marker ? cells(focus.marker) + 1 : 0) +
    cells(focus.ref) +
    2
  const hintCells = hint ? 3 + cells(hint) + 5 /* " jump" */ : 0
  const tail = 3 + cells(focus.reason)
  const titleMax = width - head - tail - hintCells
  if (titleMax >= 1)
    return { title: truncate(focus.title, titleMax), reason: focus.reason, hint }
  // No room for even one title cell: drop the title and spend what is left on
  // the reason, so the row still says why in one line rather than overflowing
  // into the frame. Ink compresses rather than clips an overflowing row, and a
  // row wider than its container folds the whole frame with it. The hint keeps
  // its cells here; it drops only when the reason itself would not fit.
  const reasonMax = width - head - 3 - 1 - hintCells
  if (hint === undefined || reasonMax >= 1)
    return {
      title: "",
      reason: truncate(focus.reason, Math.max(0, width - head - 3 - 1 - hintCells)),
      hint,
    }
  // Even a one-cell reason cannot keep the hint: drop it and give its cells
  // back, so the row still says why rather than saying nothing at all.
  return {
    title: "",
    reason: truncate(focus.reason, Math.max(0, width - head - 3 - 1)),
    hint: undefined,
  }
}

/**
 * One standing single-line row, the same height across loading / ready / empty
 * so the tab strip below it never jumps — the same contract `StatusStripLine`
 * keeps, and drawn in the same place, directly above the tabs.
 *
 * `undefined` while the first answer is out; `null` when the host answered
 * with nothing to point at. Either prop (`label`/`empty`) reserves the row;
 * with neither and no focus value the caller draws nothing at all.
 */
export const FocusSlotLine = ({
  focus,
  label = DEFAULT_FOCUS_LABEL,
  empty = DEFAULT_FOCUS_EMPTY,
  width,
  jumpKey,
}: {
  /** `undefined` while the first answer is out; `null` when it came back empty. */
  focus: FocusSlot | null | undefined
  /** What to call the row. The host's word; defaults to `focus`. */
  label?: string
  /** The empty sentence, drawn dim after the label when focus is null. */
  empty?: string
  /** Columns the row may use. */
  width: number
  /**
   * The key that jumps to the focus row, drawn as a quiet hint after the
   * reason. Ready rows only: loading and empty have no row to jump to, so
   * they never draw it even when it is set.
   */
  jumpKey?: string
}) => {
  if (focus === undefined)
    return (
      <Box marginBottom={1}>
        <Text dimColor>{"  · "}</Text>
        <Text dimColor>{`${label}  loading…`}</Text>
      </Box>
    )
  // The "nothing to point at" mark, wearing the same target glyph as the ready
  // row but muted: the shape says what the row is for even when it has nothing
  // to say, and the dimming says it has nothing to say right now.
  if (focus === null)
    return (
      <Box marginBottom={1}>
        <Text dimColor>{`  ${FOCUS_MARK} `}</Text>
        <Text dimColor>{`${label}  ${empty}`}</Text>
      </Box>
    )

  const mark = focus.mark ?? FOCUS_MARK
  const { title, reason, hint } = titleBudgetOf(focus, label, width, jumpKey)
  return (
    <Box marginBottom={1}>
      <Text>{"  "}</Text>
      <Text color={focus.markColor ?? colors.accent} bold>
        {`${mark} `}
      </Text>
      <Text dimColor>{`${label}  `}</Text>
      {/* The host's priority glyph in the default foreground, never a status
          hue: priority is lightness, not colour, and a red chevron here would
          claim a failure. */}
      {focus.marker ? <Text>{`${focus.marker} `}</Text> : null}
      <Text color={focusRefColor(focus)} bold>{`${focus.ref}  `}</Text>
      <Text bold>{title}</Text>
      <Text dimColor>{`   ${reason}`}</Text>
      {/* The jump key in the accent, wearing the mark's colour so the hint
          reads as pointing at the same row. Quiet by construction: three
          spaces, one key, one dim word — and drawn only while the budget
          holds it, never at the reason's expense. */}
      {hint ? (
        <>
          <Text dimColor>{"   "}</Text>
          <Text color={colors.accent} bold>
            {hint}
          </Text>
          <Text dimColor>{" jump"}</Text>
        </>
      ) : null}
    </Box>
  )
}
