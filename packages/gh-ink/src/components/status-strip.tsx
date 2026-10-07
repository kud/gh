import React from "react"
import { Box, Text } from "ink"
import { colors, Pill, pillWidth } from "@kud/ink-ui"

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

// Shape and colour together, never colour alone. The tick, the triangle, the
// cross and the question mark survive a monochrome terminal and a reader who
// cannot tell red from green; the hue is reinforcement.
//
// The three measured states are Nerd Font's check / warning / times — the same
// `check`, `warning` and `cross` names shui and ink-ui's status variants draw,
// written as escapes because raw PUA bytes get mangled by editors and diffs.
// They replaced `✓ ! ✗` on 2026-09-21, and two of the three were wrong rather
// than merely thin: `!` is "urgent" in kud's glyph lexicon and "merge conflict"
// in the health map one row below this strip, so a warning read as either; and
// a plain `✓` is a hairline at terminal size, which is what made thirteen of
// them look like a list rather than a status. The cost is the one this package
// already pays for `merged` and `closed` in health-display.ts — a terminal
// without a Nerd Font draws boxes here — and it is taken for the same reason.
//
// `unknown` is a plain `?`, and deliberately the lightest mark on the row. It
// says what it means ("no reading") where the hollow `○` it replaced said
// "open" in the lexicon, "pending" in half the tools on this machine, and
// "bullet" whenever eleven of them sat in a row — which is exactly the shape a
// misconfigured service tag produces. It takes no Nerd glyph on purpose: the
// catalogue's `question` is a filled disc heavier than the tick, and the state
// the row should be quietest about must not outweigh the one it is loud about.
export const stripGlyph = (state: StripState): [string, string] => {
  switch (state) {
    case "ok":
      return ["\u{f00c}", colors.success]
    case "warn":
      return ["\u{f071}", colors.warning]
    case "fail":
      return ["\u{f00d}", colors.error]
    case "unknown":
      return ["?", colors.muted]
  }
}

// One mark for the alarm, kept to a single cell so it never widens an item by
// more than it says. Nerd Font's fire, because the alarm IS the fire the host's
// header asks about, and because the `▲` it replaced became a second triangle
// the moment `warn` took one — two states one silhouette apart is the thing
// this file exists to prevent. Not an emoji: emoji are two cells in some
// terminals and one in others, and this row is laid out by counting.
const ALARM = "\u{f06d}"

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

// Marks first, then the name — the same grammar the narrow layout's `3 ✗`
// counts use, so a reader learns one order. The alarm sits in the mark
// cluster beside the state rather than glued to the name's tail, where
// `royalties▲` read as a stray superscript and put the two facts about one
// service a word apart.
//
// A failure names itself WITHOUT the alarm mark beside it. It draws as a
// solid error Pill with the cross inside it — `✕ billing` as one object —
// and the pill already says "failure" as loudly as the row gets, so a fire
// glyph beside it would repeat the same news in a second shape. A failing
// item's text is therefore just its mark and its name whatever flags it
// carries, and the wide renderer below skips the alarm cell for one
// entirely: the pill is the fire.
const itemText = (item: StripItem): string =>
  item.state === "fail"
    ? `${stripGlyph("fail")[0]} ${item.key}`
    : `${stripGlyph(item.state)[0]}${item.alarm ? ` ${ALARM}` : ""} ${item.key}`

// A failing item is priced at what its Pill OCCUPIES — the label plus its two
// caps — and not at the label's own length. Pricing the label alone
// under-budgets every failure by exactly two columns, and at a width the
// budget calls fitting the row overflows: Ink answers a row wider than its
// frame by compressing every flexible child in it rather than clipping, so
// the whole strip concertinas instead of one item being shed. The narrow pass
// prices the same two columns even though it draws its named failures as
// plain text, keeping the "mark then name" grammar — the budget is
// conservative there by two columns per named failure, and a row that budgets
// short is a row that never overflows.
//
// `pillWidth` is the same function `Pill` measures itself with, and it holds
// under `NO_COLOR` too: the pill degrades to `[✕ billing]` in brackets, which
// is the label plus two caps by another shape, so one budget covers both and
// the words stay legible with the fill stripped.
const itemWidth = (item: StripItem): number =>
  item.state === "fail" ? pillWidth(itemText(item)) : itemText(item).length

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
  // Priced at rendered widths, not string lengths: a failing item draws as a
  // Pill two columns wider than its label — see `itemWidth` — so the string
  // above under-counts the row by two per failure.
  const fullWidth =
    strip.items.reduce((n, item) => n + itemWidth(item), 0) +
    Math.max(0, strip.items.length - 1) * 2
  if (fixed + fullWidth <= width)
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
    // Each named failure budgets its pill's two caps on top of the string —
    // see `itemWidth` — or the narrow row overflows by exactly the caps the
    // wide row was priced for.
    const textWidth =
      text.length + 2 * named.filter((i) => i.state === "fail").length
    if (fixed + textWidth <= width) break
  }
  return { parts: null, summary: text, age }
}

// Brightness follows importance, and the name carries it as well as the mark:
// a fire lights its name in the error colour and bold, an unmeasured thing
// dims to the same weight as its `?`, and everything fine stays at the row's
// resting weight. On a row of thirteen this is what makes the two that matter
// the first thing seen — and when most of the row is unknown, what makes it
// read as a quiet grey line with the fires standing out of it, rather than
// thirteen names at full brightness competing with two crosses. Only the marks
// that ask for something are bold; a bold tick twelve times over was the
// loudest thing on the row for the least reason.
//
// A failure used to light its name here alongside the alarm. It draws as a
// solid error Pill now, which inks itself against its own fill, so this keeps
// only the alarm's share of that contract — a caller never picks a foreground
// for a fill it does not own, and the renderer below never calls this for a
// failing item at all.
const nameStyle = (
  item: StripItem,
): { color?: string; bold?: boolean; dimColor?: boolean } => {
  if (item.alarm) return { color: colors.error, bold: true }
  if (item.state === "unknown") return { dimColor: true }
  return {}
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
  // The "no reading" mark, so the row with no strip at all and an item with no
  // reading say it with the same shape.
  if (strip === null)
    return (
      <Box marginBottom={1}>
        <Text dimColor>{`  ${stripGlyph("unknown")[0]} `}</Text>
        <Text dimColor>{`${label}  no signal / not configured`}</Text>
      </Box>
    )

  const { parts, summary, age } = stripLayout(strip, width, now)
  return (
    <Box marginBottom={1}>
      <Text dimColor>{`  ${strip.title}  `}</Text>
      {parts ? (
        parts.map((item, i) => {
          // A failure is the one item that draws as a Pill — solid error,
          // mark inside — rather than as a mark beside a name. Solid is the
          // event tone and a failure is the event this row exists to announce;
          // every other state keeps the mark-and-name drawing it always had,
          // because a row where everything is a pill has no way to say which
          // pill is the news. The alarm cell is skipped for a failing item for
          // the reason `itemText` gives: the pill already is the fire.
          if (item.state === "fail")
            return (
              <React.Fragment key={item.key}>
                {i > 0 ? <Text>{"  "}</Text> : null}
                <Pill variant="error" tone="solid">
                  {itemText(item)}
                </Pill>
              </React.Fragment>
            )
          const [glyph, color] = stripGlyph(item.state)
          // Failures never reach this branch — they returned as a Pill above —
          // so only the warning still asks in bold here.
          const asking = item.state === "warn"
          return (
            <React.Fragment key={item.key}>
              {i > 0 ? <Text>{"  "}</Text> : null}
              <Text
                color={item.state === "unknown" ? undefined : color}
                dimColor={item.state === "unknown"}
                bold={asking}
              >
                {glyph}
              </Text>
              {item.alarm ? (
                <Text color={colors.error} bold>
                  {` ${ALARM}`}
                </Text>
              ) : null}
              <Text {...nameStyle(item)}> {item.key}</Text>
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
