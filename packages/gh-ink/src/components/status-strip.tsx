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
  /** When this snapshot was taken (ms). Drawn as an age at the end of the line. */
  at?: number
  /**
   * Why every item is unknown, when it is one shared reason (`monitoring
   * unreachable`). Turns the line into one sentence instead of one `? no data`
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

// One row, always one row. The split into two rows on 2026-10-23 — which
// amended 2026-09-21's single roll call (`✓ api  ? web  ⚠ search …`) because
// thirteen marks in a line were unreadable, fire beside tick meaning "serving
// fine, build red" — was amended again on 2026-10-26, when the ruling that
// settled what a bold name means on this terminal arrived: some terminals
// repaint bold default-foreground text in a custom colour, so the bold names
// the two-row layout drew for the fine services read as a fourth state the
// strip never declared. The strip is one line again, titled with its own
// title, naming
// ONLY what needs a look, worst first, as `name: mark cause · build ✕`, three
// spaces apart because `·` already lives inside an item. Fine services are
// counted, not listed: on a busy day the last problem item is followed by
// `✓ N fine`, green tick, muted words, and on a calm day the whole line is
// `✓ all N fine`. Either way the row never changes height when a service
// turns red, which is exactly the moment the board below must not jump.
//
// No name on the line is bold. Some terminals paint bold default-foreground
// text in a custom colour, so a bold name of any state reads as tinted ink,
// a third coding beside the marks — a whole row of such names reads as a
// second state set. Names are regular in the default foreground; the mark and the
// cause word carry the state. Only `?` and its `no data` go grey. The solid
// failure Pill and the Nerd fire stay away for the old reason: a bold red
// cross beside a red word already says "failure", and the build reads as the
// word `build` and the same cross, after a dim `·`.
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

// Where an item sits on the strip. A red build on a healthy service outranks
// "no data": the build is something to act on, the missing reading is not.
// `null` means the item is fine and may be counted without being named.
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
  { text: item.key },
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

// The line with every rank in `folded` reduced to a count and only the first
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

// The row's forms, most to least detailed; the first that fits is drawn and the
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
    // "All N fine" only when the line would otherwise be empty — it is the
    // answer on a calm day. Regular weight: bold default-foreground is
    // restyled by some terminals, and the tick already carries the verdict.
    const calm: StripSpan[] =
      items.length > 0
        ? [
            { text: OK, color: colors.success },
            { text: ` all ${items.length} fine` },
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

export type StripRows = {
  /** The line as plain text, without its title or age. */
  issues: string
  /** The age as drawn (`8m ago`), or `""` when it was shed or never stamped. */
  age: string
  /** The same line as styled runs — exactly what the renderer draws. */
  spans: StripSpan[]
  /** The title, as drawn, so a host laying out its own row lines up. */
  title: string
}

/**
 * The strip's one line at the width it has to fit. Exported so a test — or a
 * host laying out its own row — can ask the same question the renderer asks.
 * The fine services are reserved BEFORE the problem items are chosen: their
 * count is paid for first, so the widest candidate that fits still leaves the
 * tail on the row, and truncation never sheds it.
 */
export const stripRows = (
  strip: StatusStrip,
  width: number,
  now = Date.now(),
): StripRows => {
  const title = `  ${strip.title}  `
  const label = ageLabel(strip.at, now)
  const ageText = label ? `${label} ago` : ""
  const ageWidth = ageText ? 3 + ageText.length : 0
  const budget = width - title.length

  // Counted, never listed: the names of the fine services could hide at
  // arbitrary places in a truncated run, and a reader could not tell which
  // were fine — the count can be truncated in nobody's interest but its own,
  // which is why its width is reserved before the problems are chosen. The
  // tail is separated from the items exactly as the items are separated.
  const hasProblems = strip.items.some((i) => rankOf(i) !== null)
  const fineCount = hasProblems
    ? strip.items.filter((i) => rankOf(i) === null).length
    : 0
  const fineSpans: StripSpan[] =
    fineCount > 0
      ? [
          { text: OK, color: colors.success },
          { text: ` ${fineCount} fine`, color: colors.muted },
        ]
      : []
  const fineWidth = fineSpans.length
    ? ITEM_GAP.length + widthOf(fineSpans)
    : 0

  const candidates = issueCandidates(strip)
  const chosen =
    candidates.find(
      (c) => widthOf(c.spans) + (c.age ? ageWidth : 0) <= budget - fineWidth,
    ) ?? candidates[candidates.length - 1]!
  const tail: StripSpan[] =
    fineSpans.length ? [{ text: ITEM_GAP } as StripSpan, ...fineSpans] : []
  const spans = [...chosen.spans, ...tail]

  return {
    issues: textOf(spans),
    age: chosen.age ? ageText : "",
    spans,
    title,
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
 * A standing single-line row, the same height across loading / absent / ready —
 * one line and one margin — so the content below it never jumps: the same
 * contract `CiStatusLine` keeps, and drawn in the same place, because a reader
 * learns one row of glances. The host reserves those two rows out of its own
 * budget; a third here would clip the frame from the top.
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
  // its time reads as working rather than stuck. It is one cell wide, and
  // unmounts the moment data arrives.
  if (strip === undefined)
    return (
      <Box marginBottom={1}>
        <Text>{"  "}</Text>
        <Spinner />
        <Text dimColor>{` ${label}  loading…`}</Text>
      </Box>
    )
  // The "no reading" mark, so the row with no strip at all and an item with no
  // reading say it with the same shape.
  if (strip === null)
    return (
      <Box marginBottom={1}>
        <Text dimColor>
          {`  ${stripGlyph("unknown")[0]} ${label}  no signal / not configured`}
        </Text>
      </Box>
    )

  const { spans, age, title } = stripRows(strip, width, now)
  return (
    <Box marginBottom={1}>
      <Text dimColor>{title}</Text>
      <Spans spans={spans} />
      {age ? <Text dimColor>{`   ${age}`}</Text> : null}
    </Box>
  )
}
