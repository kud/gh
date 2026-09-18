import React from "react"
import { Box, Text } from "ink"
import { colors } from "@kud/ink-ui"

/**
 * One state per thing, from a closed set the strip knows how to draw. The host
 * decides what "warn" means — an error-rate edge, a stale feed, a flaky build —
 * and the strip only ever says it with a shape.
 *
 * `unknown` is a state and not the absence of one: "nothing heard from it" is
 * a fact about the feed that a green tick would paper over, and a strip that
 * draws an unmeasured thing as fine is the one failure it cannot afford.
 */
export type StripState = "ok" | "warn" | "fail" | "unknown"

export type StripItem = {
  /** The name on screen. Short — it is drawn once per item across one line. */
  key: string
  state: StripState
  /**
   * A second, independent alarm beside the state — a build on fire next to a
   * service that is serving fine, say. Drawn as its own mark rather than folded
   * into `state`, because the two answer different questions and a reader
   * needs to see when they disagree.
   */
  alarm?: boolean
  /** Where `o` goes when this item is opened from a rail row. Unused here. */
  url?: string
}

export type StatusStrip = {
  /** What the row is a strip OF, in the host's words: `services`, say. */
  title: string
  items: StripItem[]
  /** When this snapshot was taken (ms). Drawn as an age at the end of the row. */
  at?: number
}

// Shape and colour together, never colour alone. The tick, the bang and the
// cross survive a monochrome terminal and a reader who cannot tell red from
// green; the hue is reinforcement. `○` for unknown is hollow on purpose — an
// empty shape for an empty reading.
export const stripGlyph = (state: StripState): [string, string] => {
  switch (state) {
    case "ok":
      return ["✓", colors.success]
    case "warn":
      return ["!", colors.warning]
    case "fail":
      return ["✗", colors.error]
    case "unknown":
      return ["○", colors.muted]
  }
}

// One mark for the alarm, kept to a single cell so it never widens an item by
// more than it says. `▲` rather than an emoji: emoji are two cells in some
// terminals and one in others, and this row is laid out by counting.
const ALARM = "▲"

// The rank of a state when the strip has to choose what to name and what to
// count. Worst first, because a narrow row has room for exactly one story.
const SEVERITY: Record<StripState, number> = {
  fail: 0,
  warn: 1,
  unknown: 2,
  ok: 3,
}

export const ageLabel = (at: number | undefined, now = Date.now()): string => {
  if (at === undefined) return ""
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.round(m / 60)}h`
}

const itemText = (item: StripItem): string =>
  `${stripGlyph(item.state)[0]} ${item.key}${item.alarm ? ALARM : ""}`

/**
 * The strip as plain text, at the width it has to fit. Exported so a test — or a
 * host laying out its own row — can ask the same question the renderer asks.
 *
 * Wide: every item named with its mark, so the row reads as a roll call. Narrow:
 * counts for what is fine, and names ONLY for what is not — the reader of a
 * narrow terminal loses the roll call, never the failures. When even the
 * failures do not fit, the worst few are named and the rest counted, so the
 * row still says "and N more" rather than silently dropping the fourth fire.
 */
export const stripLayout = (
  strip: StatusStrip,
  width: number,
  now = Date.now(),
): { parts: StripItem[] | null; summary: string; age: string } => {
  const age = ageLabel(strip.at, now)
  const fixed = 2 + strip.title.length + 2 + (age ? age.length + 3 : 0)
  const full = strip.items.map(itemText).join("  ")
  if (fixed + full.length <= width)
    return { parts: strip.items, summary: full, age }

  const sorted = [...strip.items].sort(
    (a, b) => SEVERITY[a.state] - SEVERITY[b.state],
  )
  const bad = sorted.filter((i) => i.state !== "ok" || i.alarm)
  const ok = strip.items.length - bad.length
  const tally = (n: number, s: StripState) =>
    n > 0 ? `${n} ${stripGlyph(s)[0]}` : ""

  // Name the worst while they fit; count the rest of them by state.
  let named: StripItem[] = []
  let text = ""
  for (let n = bad.length; n >= 0; n--) {
    named = bad.slice(0, n)
    const rest = bad.slice(n)
    const counts = (["fail", "warn", "unknown"] as StripState[])
      .map((s) => tally(rest.filter((i) => i.state === s).length, s))
      .filter(Boolean)
    text = [tally(ok, "ok"), ...counts, ...named.map(itemText)]
      .filter(Boolean)
      .join(" · ")
    if (fixed + text.length <= width) break
  }
  return { parts: null, summary: text, age }
}

/**
 * A standing single-line row, the same height across loading / absent / ready
 * so the content below it never jumps — the same contract `CiStatusLine` keeps,
 * and drawn in the same place, because a reader learns one row of glances.
 */
export const StatusStripLine = ({
  strip,
  label = "status",
  width,
  now,
}: {
  /** `undefined` while the first poll is out; `null` when the host has nothing. */
  strip: StatusStrip | null | undefined
  /** What to call the row before the data arrives with its own title. */
  label?: string
  /** Columns the row may use. */
  width: number
  now?: number
}) => {
  if (strip === undefined)
    return (
      <Box marginBottom={1}>
        <Text dimColor>{"  · "}</Text>
        <Text dimColor>{`${label}  loading…`}</Text>
      </Box>
    )
  if (strip === null)
    return (
      <Box marginBottom={1}>
        <Text dimColor>{"  ○ "}</Text>
        <Text dimColor>{`${label}  no signal / not configured`}</Text>
      </Box>
    )

  const { parts, summary, age } = stripLayout(strip, width, now)
  return (
    <Box marginBottom={1}>
      <Text dimColor>{`  ${strip.title}  `}</Text>
      {parts ? (
        parts.map((item, i) => {
          const [glyph, color] = stripGlyph(item.state)
          return (
            <React.Fragment key={item.key}>
              {i > 0 ? <Text>{"  "}</Text> : null}
              <Text color={color} bold>
                {glyph}
              </Text>
              <Text> {item.key}</Text>
              {item.alarm ? (
                <Text color={colors.error} bold>
                  {ALARM}
                </Text>
              ) : null}
            </React.Fragment>
          )
        })
      ) : (
        <Text>{summary}</Text>
      )}
      {age ? <Text dimColor>{`   ${age}`}</Text> : null}
    </Box>
  )
}
