import React from "react"
import { Box, Text } from "ink"
import { colors, Spinner } from "@kud/ink-ui"

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
   * Why the state is what it is, as a short word the host chooses: `slow`,
   * `errors`, `errors · slow`, `alerting`. Drawn after the mark in the mark's
   * colour. Ignored for `ok`; `unknown` draws `no data` itself.
   */
  cause?: string
  /**
   * The thing's latest trunk build is red. Independent of `state` and drawn
   * as its own `build ✕` beside it rather than folded in, because the two
   * answer different questions and a reader needs to see when they disagree.
   * Folding them — a red build downgrading a tick to a warning — was ruled
   * against on 2026-10-23: it loses which system is broken.
   */
  alarm?: boolean
  /** Where `o` goes when this item is opened from a rail row. Unused here. */
  url?: string
}

export type StatusStrip = {
  /** What the row is a strip OF, in the host's words: `services`, say. */
  title: string
  items: StripItem[]
  /** When this snapshot was taken (ms). Drawn as an age at the end of row 1. */
  at?: number
  /**
   * Why every item is unknown, when it is one shared reason (`monitoring
   * unreachable`). Turns row 1 into one sentence instead of one `? no data`
   * per item — thirteen identical items say less than the sentence does.
   */
  note?: string
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

// Two rows, from the 2026-10-23 ruling, which amends 2026-09-21's single roll
// call (`✓ api  ? web  ⚠ search …`) after it proved unreadable: thirteen
// marks in a line, each a different colour, with a fire beside a tick meaning
// "serving fine, build red". Row 1, titled with the strip's own title, names
// ONLY what needs a look, worst first, as `name: mark cause · build ✕`, three
// spaces apart because `·` already lives inside an item. Row 2, `success`, is
// one shared tick and then every name that is fine. Both rows are always
// drawn, so the strip never changes height when a service turns red — which
// is exactly the moment the board below must not jump.
//
// Every name is bold in the default foreground, whatever its state. The old
// ruling let the name carry the weight — red and bold for a fire, dim for no
// reading — and a row of coloured names became a second code beside the
// marks. The mark and the cause word carry the state now; only `?` and its
// `no data` go grey. The solid failure Pill and the Nerd fire went with it:
// a bold red cross beside a red word already says "failure", and the build
// reads as the word `build` and the same cross, after a dim `·`.
//
// Every token is priced at its string length, which is its cell width: the
// marks are single UTF-16 units drawing one cell each, `?` included, and no
// emoji appears anywhere — emoji are one cell in some terminals and two in
// others, and these rows are laid out by counting. Ink answers a row wider
// than its frame by compressing every flexible child in it rather than
// clipping, so an under-budgeted row concertinas instead of shedding an item;
// every fit below is decided on the same widths the renderer draws.

const OK = stripGlyph("ok")[0]
const WARN = stripGlyph("warn")[0]
const FAIL = stripGlyph("fail")[0]
const SUCCESS_TITLE = "success"
const ITEM_GAP = "   "

/** One run of text in one style — the unit both the budget and the renderer read. */
export type StripSpan = {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
}

const dim = (text: string): StripSpan => ({ text, dim: true })
const widthOf = (spans: StripSpan[]): number =>
  spans.reduce((n, span) => n + span.text.length, 0)
const textOf = (spans: StripSpan[]): string =>
  spans.map((span) => span.text).join("")

const joinWith = (groups: StripSpan[][], sep: StripSpan): StripSpan[] =>
  groups.flatMap((group, i) => (i === 0 ? group : [sep, ...group]))

// Where an item sits on row 1, worst first. A red build on a healthy service
// outranks "no data": the build is something to act on, the missing reading
// is not. `null` is fine — it belongs on row 2 and never on row 1.
type Rank = "fail" | "warn" | "build" | "unknown"
const SEVERITY: Record<Rank, number> = {
  fail: 0,
  warn: 1,
  build: 2,
  unknown: 3,
}

const rankOf = (item: StripItem): Rank | null => {
  if (item.state === "ok") return item.alarm ? "build" : null
  return item.state
}

// `build ✕`: the word in the error colour, the cross bold. A word rather than
// a mark of its own, because every single-glyph alarm tried here — `▲`, then
// the fire — either collided with a state's silhouette or could not be read.
const buildSpans = (): StripSpan[] => [
  { text: "build ", color: colors.error },
  { text: FAIL, color: colors.error, bold: true },
]

const nameSpans = (item: StripItem): StripSpan[] => [
  { text: item.key, bold: true },
  dim(":"),
  { text: " " },
]

const itemSpans = (item: StripItem): StripSpan[] => {
  const spans = nameSpans(item)
  switch (item.state) {
    case "fail":
      spans.push({ text: FAIL, color: colors.error, bold: true })
      if (item.cause)
        spans.push({ text: ` ${item.cause}`, color: colors.error, bold: true })
      break
    case "warn":
      spans.push({ text: WARN, color: colors.warning, bold: true })
      if (item.cause)
        spans.push({ text: ` ${item.cause}`, color: colors.warning })
      break
    case "unknown":
      spans.push(dim("? no data"))
      break
    case "ok":
      spans.push({ text: OK, color: colors.success })
  }
  if (item.alarm)
    spans.push({ text: " " }, dim("·"), { text: " " }, ...buildSpans())
  return spans
}

// A folded rank is mark first, then the number — `? 2`, `build ✕ 3` — in that
// mark's colour and weight, so a count reads as the items it stands for.
const countSpans = (rank: Rank, n: number): StripSpan[] => {
  switch (rank) {
    case "fail":
      return [{ text: `${FAIL} ${n}`, color: colors.error, bold: true }]
    case "warn":
      return [{ text: `${WARN} ${n}`, color: colors.warning, bold: true }]
    case "build":
      return [...buildSpans(), { text: ` ${n}`, color: colors.error }]
    case "unknown":
      return [dim(`? ${n}`)]
  }
}

// Row 1 with every rank in `folded` reduced to a count and only the first
// `failsNamed` failures named. A folded item counts under its state AND, when
// its build is red, under `build ✕` — so folding a warning never silently
// drops the red build that rode on it.
const foldedIssues = (
  bad: StripItem[],
  folded: ReadonlySet<Rank>,
  failsNamed: number,
): StripSpan[] => {
  let fails = 0
  const named: StripItem[] = []
  const rest: StripItem[] = []
  for (const item of bad) {
    const rank = rankOf(item) as Rank
    const keep = rank === "fail" ? fails++ < failsNamed : !folded.has(rank)
    ;(keep ? named : rest).push(item)
  }
  const tallies: [Rank, number][] = [
    ["fail", rest.filter((i) => i.state === "fail").length],
    ["warn", rest.filter((i) => i.state === "warn").length],
    ["build", rest.filter((i) => i.alarm).length],
    ["unknown", rest.filter((i) => i.state === "unknown").length],
  ]
  return joinWith(
    [
      ...named.map(itemSpans),
      ...tallies
        .filter(([, n]) => n > 0)
        .map(([rank, n]) => countSpans(rank, n)),
    ],
    { text: ITEM_GAP },
  )
}

type Candidate = { spans: StripSpan[]; age: boolean }

// Row 1's forms, most to least detailed; the first that fits is drawn and the
// last is drawn regardless. Narrowing sheds the least actionable first: the
// no-data items fold to `? N`, then the healthy-with-red-build ones to
// `build ✕ N`, then the warnings to `⚠ N`. The failures stay named longest —
// the age goes before any of them does — and when even they do not fit, the
// worst are named while they fit and the rest counted, so the row says "and
// N more" rather than silently dropping the fourth failure.
const issueCandidates = (strip: StatusStrip): Candidate[] => {
  const { items, note } = strip
  if (note !== undefined) {
    // One shared sentence for the reading, and the red builds still named:
    // the build comes from a different source, which did answer. Named with
    // no health mark, because there is no health reading to show.
    const sentence = dim(`? no data for all ${items.length} · ${note}`)
    const builds = items.filter((i) => i.alarm)
    const named = joinWith(
      [[sentence], ...builds.map((i) => [...nameSpans(i), ...buildSpans()])],
      { text: ITEM_GAP },
    )
    const counted = joinWith(
      [
        [sentence],
        ...(builds.length ? [countSpans("build", builds.length)] : []),
      ],
      { text: ITEM_GAP },
    )
    return [
      { spans: named, age: true },
      { spans: counted, age: true },
      { spans: counted, age: false },
    ]
  }

  const bad = items
    .filter((i) => rankOf(i) !== null)
    .sort((a, b) => SEVERITY[rankOf(a)!] - SEVERITY[rankOf(b)!])
  if (bad.length === 0) {
    // "All N fine" only when row 1 would otherwise be empty — it is the
    // answer on a calm day, so its words are the one bold sentence here.
    const calm: StripSpan[] =
      items.length > 0
        ? [
            { text: OK, color: colors.success },
            { text: ` all ${items.length} fine`, bold: true },
          ]
        : [dim("? no data")]
    return [
      { spans: calm, age: true },
      { spans: calm, age: false },
    ]
  }

  const fails = bad.filter((i) => i.state === "fail").length
  const levels: Rank[][] = [
    [],
    ["unknown"],
    ["unknown", "build"],
    ["unknown", "build", "warn"],
  ]
  const everything = new Set(levels[levels.length - 1])
  const candidates: Candidate[] = levels.map((level) => ({
    spans: foldedIssues(bad, new Set(level), fails),
    age: true,
  }))
  for (let named = fails; named >= 0; named--)
    candidates.push({ spans: foldedIssues(bad, everything, named), age: false })
  return candidates
}

// Row 2 is the whole list of fine names or their count, never a partial list:
// a list that silently ends after the fourth name hides arbitrary services,
// and a reader cannot tell which.
const successSpans = (strip: StatusStrip, budget: number): StripSpan[] => {
  const fine = strip.items.filter((i) => rankOf(i) === null)
  if (fine.length === 0)
    return [
      dim(
        strip.items.every((i) => i.state === "unknown")
          ? "nothing measured"
          : "none",
      ),
    ]
  const tick: StripSpan = { text: OK, color: colors.success }
  const full = [
    tick,
    { text: " " },
    ...joinWith(
      fine.map((i) => [{ text: i.key, bold: true }]),
      dim(" · "),
    ),
  ]
  if (widthOf(full) <= budget) return full
  return [tick, { text: ` ${fine.length} ${strip.title}` }]
}

export type StripRows = {
  /** Row 1 as plain text, without its title or age. */
  issues: string
  /** Row 2 as plain text, without its title. */
  success: string
  /** The age as drawn (`8m ago`), or `""` when it was shed or never stamped. */
  age: string
  /** The same rows as styled runs — exactly what the renderer draws. */
  spans: { issues: StripSpan[]; success: StripSpan[] }
  /** Both titles, padded to one width so the rows' content lines up. */
  titles: [string, string]
}

/**
 * Both rows of the strip at the width they have to fit. Exported so a test —
 * or a host laying out its own row — can ask the same question the renderer
 * asks.
 */
export const stripRows = (
  strip: StatusStrip,
  width: number,
  now = Date.now(),
): StripRows => {
  const titleWidth = Math.max(strip.title.length, SUCCESS_TITLE.length)
  const titles: [string, string] = [
    `  ${strip.title.padEnd(titleWidth)}  `,
    `  ${SUCCESS_TITLE.padEnd(titleWidth)}  `,
  ]
  const label = ageLabel(strip.at, now)
  const ageText = label ? `${label} ago` : ""
  const ageWidth = ageText ? 3 + ageText.length : 0
  const budget = width - titles[0].length

  const candidates = issueCandidates(strip)
  const chosen =
    candidates.find(
      (c) => widthOf(c.spans) + (c.age ? ageWidth : 0) <= budget,
    ) ?? candidates[candidates.length - 1]!
  const success = successSpans(strip, budget)

  return {
    issues: textOf(chosen.spans),
    success: textOf(success),
    age: chosen.age ? ageText : "",
    spans: { issues: chosen.spans, success },
    titles,
  }
}

export const ageLabel = (at: number | undefined, now = Date.now()): string => {
  if (at === undefined) return ""
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.round(m / 60)}h`
}

const Spans = ({ spans }: { spans: StripSpan[] }) => (
  <>
    {spans.map((span, i) => (
      <Text key={i} color={span.color} bold={span.bold} dimColor={span.dim}>
        {span.text}
      </Text>
    ))}
  </>
)

/**
 * A standing two-line row, the same height across loading / absent / ready
 * — two lines and one margin — so the content below it never jumps: the same
 * contract `CiStatusLine` keeps, and drawn in the same place, because a reader
 * learns one row of glances. The host reserves those three rows out of its
 * own budget; a fourth here would clip the frame from the top.
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
  // A live spinner rather than a static `·`, so a first poll that is taking
  // its time reads as working rather than stuck. It is one cell wide, the same
  // as the dot on the row beneath it, and unmounts the moment data arrives.
  if (strip === undefined)
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text>{"  "}</Text>
          <Spinner />
          <Text dimColor>{` ${label}  loading…`}</Text>
        </Box>
        <Text dimColor>{`  · ${SUCCESS_TITLE}`}</Text>
      </Box>
    )
  // The "no reading" mark, so the row with no strip at all and an item with no
  // reading say it with the same shape. The second line is drawn blank rather
  // than left out: the height is the contract, not the content.
  if (strip === null)
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>
          {`  ${stripGlyph("unknown")[0]} ${label}  no signal / not configured`}
        </Text>
        <Text> </Text>
      </Box>
    )

  const { spans, age, titles } = stripRows(strip, width, now)
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text dimColor>{titles[0]}</Text>
        <Spans spans={spans.issues} />
        {age ? <Text dimColor>{`   ${age}`}</Text> : null}
      </Box>
      <Box>
        <Text dimColor>{titles[1]}</Text>
        <Spans spans={spans.success} />
      </Box>
    </Box>
  )
}
