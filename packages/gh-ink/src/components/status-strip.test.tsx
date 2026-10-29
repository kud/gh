import React from "react"
import { Box, Text } from "ink"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import { colors } from "@kud/ink-ui"
import {
  StatusStripLine,
  ageLabel,
  stripGlyph,
  stripRows,
  type StatusStrip,
} from "./status-strip.js"

const OK = "\u{f00c}"
const WARN = "\u{f071}"
const FAIL = "\u{f00d}"

// Unmounted every time: the loading row carries a live spinner, and a mounted
// one would keep its interval running past the test.
const frameOf = (node: React.ReactElement) => {
  const instance = render(node)
  const frame = instance.lastFrame() ?? ""
  instance.unmount()
  return frame
}

// "  services  " — two, the title padded to `services`, two.
const TITLES = 12
const NOW = 1_000_000
const AGED = NOW - 8 * 60_000
const AGE = "   8m ago".length

// A bad day across every rank, in config order, so the tests can see the
// worst-first sort undo it.
const badDay: StatusStrip = {
  title: "services",
  at: AGED,
  items: [
    { key: "api", state: "ok" },
    { key: "web", state: "unknown" },
    { key: "search", state: "warn", cause: "slow", alarm: true },
    { key: "worker", state: "ok" },
    { key: "billing", state: "fail", cause: "alerting" },
    { key: "events", state: "warn", cause: "errors" },
    { key: "auth", state: "ok" },
    { key: "payments", state: "ok", alarm: true },
    { key: "cron", state: "unknown" },
  ],
}

const fullIssues =
  `billing: ${FAIL} alerting   search: ${WARN} slow · build ${FAIL}   ` +
  `events: ${WARN} errors   payments: ${OK} · build ${FAIL}   ` +
  `? 2 no data   ${OK} 3 fine`

// The width at which `issues` plus the title — and the age, when kept — fills
// the row exactly. One column less must shed the next thing.
const fits = (issues: string, age = true) =>
  TITLES + issues.length + (age ? AGE : 0)

describe("stripGlyph", () => {
  // Nerd Font check / warning / times, one UTF-16 unit each so the width
  // arithmetic in stripRows counts them as the single cell they draw.
  it("gives every state its own shape, not only its own colour", () => {
    expect(stripGlyph("ok")[0]).toBe(OK)
    expect(stripGlyph("warn")[0]).toBe(WARN)
    expect(stripGlyph("fail")[0]).toBe(FAIL)
    expect(stripGlyph("unknown")[0]).toBe("?")
  })

  it("never lets two states share a silhouette, and prices each at one cell", () => {
    const states = ["ok", "warn", "fail", "unknown"] as const
    const shapes = states.map((s) => stripGlyph(s)[0])
    expect(new Set(shapes).size).toBe(states.length)
    for (const shape of shapes) expect(shape).toHaveLength(1)
  })
})

describe("ageLabel", () => {
  it("says nothing when there is no snapshot yet", () => {
    expect(ageLabel(undefined)).toBe("")
  })

  it("counts in seconds under a minute", () => {
    expect(ageLabel(NOW - 5_000, NOW)).toBe("5s")
  })

  it("switches to rounded minutes once a minute has passed", () => {
    expect(ageLabel(NOW - 90_000, NOW)).toBe("2m")
  })

  it("switches to rounded hours once an hour has passed", () => {
    expect(ageLabel(NOW - 2 * 3_600_000, NOW)).toBe("2h")
  })

  it("keeps hours through the second day, then counts days", () => {
    expect(ageLabel(NOW - 47 * 3_600_000, NOW)).toBe("47h")
    expect(ageLabel(NOW - 3 * 86_400_000, NOW)).toBe("3d")
  })
})

describe("stripRows: since when, and settled", () => {
  const DAYS_3 = NOW - 3 * 86_400_000

  it("draws how long a failure has held after its cause, in the cause's style", () => {
    const { issues, spans } = stripRows(
      {
        title: "services",
        items: [
          {
            key: "ledger",
            state: "fail",
            cause: "alerting",
            since: NOW - 20 * 60_000,
          },
        ],
      },
      200,
      NOW,
    )
    expect(issues).toBe(`ledger: ${FAIL} alerting 20m`)
    expect(spans.find((s) => s.text === " alerting 20m")).toMatchObject({
      color: colors.error,
      bold: true,
    })
  })

  it("draws a settled failure dim, still a cross, after fresh trouble and builds", () => {
    const { issues, spans } = stripRows(
      {
        title: "services",
        items: [
          {
            key: "search",
            state: "fail",
            cause: "alerting",
            since: DAYS_3,
            settled: true,
          },
          { key: "unread", state: "unknown" },
          { key: "exports", state: "ok", alarm: true },
          { key: "events", state: "warn" },
        ],
      },
      200,
      NOW,
    )
    expect(issues).toBe(
      `events: ${WARN}   exports: ${OK} · build ${FAIL}   ` +
        `search: ${FAIL} alerting 3d   ? 1 no data`,
    )
    const cross = spans.filter((s) => s.text === FAIL).at(-1)
    expect(cross).toMatchObject({ dim: true })
    expect(cross?.color).toBeUndefined()
    expect(spans.find((s) => s.text === " alerting 3d")).toMatchObject({
      dim: true,
    })
  })

  it("only settles a failure: a settled warning stays a warning", () => {
    const { spans } = stripRows(
      {
        title: "services",
        items: [{ key: "a", state: "warn", settled: true }],
      },
      200,
      NOW,
    )
    expect(spans.find((s) => s.text === WARN)).toMatchObject({
      color: colors.warning,
      bold: true,
    })
  })
})

describe("stripRows: what row 1 names", () => {
  it("names only what needs a look, worst first: fail, warn, red build, no data", () => {
    const rows = stripRows(badDay, 200, NOW)
    expect(rows.issues).toBe(fullIssues)
    expect(rows.age).toBe("8m ago")
  })

  it("keeps config order within a rank", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [
          { key: "b", state: "warn" },
          { key: "a", state: "warn" },
        ],
      },
      200,
    )
    expect(issues).toBe(`b: ${WARN}   a: ${WARN}`)
  })

  it("draws the host's cause after the mark, and none for ok", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [
          { key: "a", state: "fail", cause: "errors · slow" },
          { key: "b", state: "warn", cause: "errors" },
          { key: "c", state: "ok", cause: "slow" },
        ],
      },
      200,
    )
    expect(issues).toBe(
      `a: ${FAIL} errors · slow   b: ${WARN} errors   ${OK} 1 fine`,
    )
  })

  it("counts the fine services after the last problem, tick green, words muted, nothing when none", () => {
    const mixed: StatusStrip = {
      title: "services",
      items: [
        { key: "a", state: "fail" },
        { key: "b", state: "unknown" },
      ],
    }
    expect(stripRows(mixed, 200).issues).toBe(`a: ${FAIL}   ? 1 no data`)
    const withFine: StatusStrip = {
      ...mixed,
      items: [...mixed.items, { key: "api", state: "ok" }],
    }
    expect(stripRows(withFine, 200).issues).toBe(
      `a: ${FAIL}   ? 1 no data   ${OK} 1 fine`,
    )
  })

  it("counts the no-data items as `? N no data`, ignoring any cause", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [{ key: "web", state: "unknown", cause: "x" }],
      },
      200,
    )
    expect(issues).toBe("? 1 no data")
  })

  it("names the healthy-with-red-build service and counts the fine behind it", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [
          { key: "api", state: "ok" },
          { key: "payments", state: "ok", alarm: true },
        ],
      },
      200,
    )
    expect(issues).toBe(`payments: ${OK} · build ${FAIL}   ${OK} 1 fine`)
  })

  it("appends the red build to a no-data item too", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [{ key: "web", state: "unknown", alarm: true }],
      },
      200,
    )
    expect(issues).toBe(`web: ? no data · build ${FAIL}`)
  })

  it("says `all N fine` only when nothing else would be on the line", () => {
    const calm: StatusStrip = {
      title: "services",
      at: AGED,
      items: [
        { key: "api", state: "ok" },
        { key: "web", state: "ok" },
        { key: "auth", state: "ok" },
      ],
    }
    const rows = stripRows(calm, 200, NOW)
    expect(rows.issues).toBe(`${OK} all 3 fine`)
    expect(rows.age).toBe("8m ago")
  })

  it("turns a shared note into one sentence and keeps red builds named", () => {
    const unreachable: StatusStrip = {
      title: "services",
      note: "monitoring unreachable",
      items: [
        { key: "api", state: "unknown" },
        { key: "search", state: "unknown", alarm: true },
        { key: "web", state: "unknown" },
      ],
    }
    const rows = stripRows(unreachable, 200)
    expect(rows.issues).toBe(
      `? no data for all 3 · monitoring unreachable   search: build ${FAIL}`,
    )
  })

  it("draws every name regular in the default foreground, whatever its state", () => {
    const { spans } = stripRows(badDay, 200, NOW)
    // The four names on the line: only the problem items are named; the fine
    // three and the two with no data are behind their counts.
    const names = new Set(
      badDay.items
        .filter((i) => (i.state !== "ok" && i.state !== "unknown") || i.alarm)
        .map((i) => i.key),
    )
    const nameSpans = spans.filter((s) => names.has(s.text))
    expect(nameSpans).toHaveLength(names.size)
    for (const span of nameSpans) {
      expect(span.bold).toBeFalsy()
      expect(span.color).toBeUndefined()
      expect(span.dim).toBeFalsy()
    }
  })

  it("colours the cross bold red, the warning bold amber, and no data grey", () => {
    const { spans } = stripRows(badDay, 200, NOW)
    const fail = spans.find((s) => s.text === FAIL)
    const warn = spans.find((s) => s.text === WARN)
    const noData = spans.find((s) => s.text === "? 2 no data")
    expect(fail).toMatchObject({ color: colors.error, bold: true })
    expect(warn).toMatchObject({ color: colors.warning, bold: true })
    expect(noData).toMatchObject({ dim: true })
  })

  it("draws the fine count in the names' colour behind a green tick", () => {
    const spans = stripRows(badDay, 200, NOW).spans
    const fine = spans.find((s) => s.text === " 3 fine")
    expect(fine).toBeDefined()
    expect(fine?.color).toBeUndefined()
    expect(spans[spans.indexOf(fine!) - 1]).toMatchObject({
      text: OK,
      color: colors.success,
    })
  })
})

describe("stripRows: narrow rows shed the least actionable first", () => {
  const tail = `   ${OK} 3 fine`
  const noBuilds =
    `billing: ${FAIL} alerting   search: ${WARN} slow · build ${FAIL}   ` +
    `events: ${WARN} errors   build ${FAIL} 1   ? 2 no data` +
    tail
  // `search` was a warning with a red build: folding it counts it under both,
  // so the build it carried is never dropped with its name.
  const noWarns =
    `billing: ${FAIL} alerting   ${WARN} 2   build ${FAIL} 2   ? 2 no data` +
    tail
  const nothingNamed =
    `${FAIL} 1   ${WARN} 2   build ${FAIL} 2   ? 2 no data` + tail

  it("names everything while it fits, the no-data items always counted", () => {
    expect(stripRows(badDay, fits(fullIssues), NOW).issues).toBe(fullIssues)
  })

  it("1. folds a settled failure into `✕ N settled` before any build", () => {
    const known: StatusStrip = {
      title: "services",
      items: [
        { key: "aaa", state: "fail", cause: "alerting", settled: true },
        { key: "bbb", state: "ok", alarm: true },
      ],
    }
    const named = `bbb: ${OK} · build ${FAIL}   aaa: ${FAIL} alerting`
    const folded = `bbb: ${OK} · build ${FAIL}   ${FAIL} 1 settled`
    expect(stripRows(known, fits(named, false), NOW).issues).toBe(named)
    expect(stripRows(known, fits(named, false) - 1, NOW).issues).toBe(folded)
  })

  it("2. then the healthy-with-red-build items into `build ✕ N`", () => {
    expect(stripRows(badDay, fits(fullIssues) - 1, NOW).issues).toBe(noBuilds)
    expect(stripRows(badDay, fits(noBuilds), NOW).issues).toBe(noBuilds)
  })

  it("3. then the warnings into `⚠ N`", () => {
    const rows = stripRows(badDay, fits(noBuilds) - 1, NOW)
    expect(rows.issues).toBe(noWarns)
    expect(rows.age).toBe("8m ago")
  })

  it("4. sheds the age before any failure name", () => {
    const rows = stripRows(badDay, fits(noWarns) - 1, NOW)
    expect(rows.issues).toBe(noWarns)
    expect(rows.age).toBe("")
  })

  it("5. counts the failures only once their names no longer fit", () => {
    const rows = stripRows(badDay, fits(noWarns, false) - 1, NOW)
    expect(rows.issues).toBe(nothingNamed)
    expect(rows.age).toBe("")
  })

  it("names the worst failures while they fit and counts the rest", () => {
    const crowded: StatusStrip = {
      title: "services",
      items: [
        { key: "aaa", state: "fail" },
        { key: "bbb", state: "fail" },
        { key: "ccc", state: "warn" },
      ],
    }
    const oneNamed = `aaa: ${FAIL}   ${FAIL} 1   ${WARN} 1`
    const twoNamed = `aaa: ${FAIL}   bbb: ${FAIL}   ${WARN} 1`
    expect(stripRows(crowded, fits(twoNamed, false), NOW).issues).toBe(twoNamed)
    expect(stripRows(crowded, fits(twoNamed, false) - 1, NOW).issues).toBe(
      oneNamed,
    )
  })

  it("never draws a row wider than its budget at any width it can meet", () => {
    for (let width = fits(nothingNamed, false); width <= 200; width++) {
      const rows = stripRows(badDay, width, NOW)
      const drawn =
        TITLES + rows.issues.length + (rows.age ? 3 + rows.age.length : 0)
      expect(drawn).toBeLessThanOrEqual(width)
    }
  })

  it("folds the shared note's red builds into a count, then drops the age", () => {
    const unreachable: StatusStrip = {
      title: "services",
      note: "monitoring unreachable",
      at: AGED,
      items: [
        { key: "api", state: "unknown", alarm: true },
        { key: "web", state: "unknown" },
      ],
    }
    const named = `? no data for all 2 · monitoring unreachable   api: build ${FAIL}`
    const counted = `? no data for all 2 · monitoring unreachable   build ${FAIL} 1`
    expect(stripRows(unreachable, fits(named), NOW).issues).toBe(named)
    const folded = stripRows(unreachable, fits(named) - 1, NOW)
    expect(folded).toMatchObject({ issues: counted, age: "8m ago" })
    expect(stripRows(unreachable, fits(counted) - 1, NOW)).toMatchObject({
      issues: counted,
      age: "",
    })
  })

  it("keeps the fine count on the line at the width where the items just stop fitting", () => {
    const rows = stripRows(badDay, fits(nothingNamed, false), NOW)
    expect(rows.issues).toBe(nothingNamed)
    expect(rows.age).toBe("")
  })
})

describe("StatusStripLine", () => {
  // A sentinel below the strip, so the height is measured where the next row
  // starts — trailing blank lines are not something a frame reports reliably.
  // A sentinel below the strip, so the height is measured where the next row
  // starts — trailing blank lines are not something a frame reports reliably.
  const heightOf = (strip: StatusStrip | null | undefined) => {
    const frame = frameOf(
      <Box flexDirection="column">
        <StatusStripLine strip={strip} label="services" width={100} now={NOW} />
        <Text>END</Text>
      </Box>,
    )
    return frame.split("\n").findIndex((line) => line.includes("END"))
  }

  it("keeps one height — one line and a margin — loading, absent and ready", () => {
    expect(heightOf(undefined)).toBe(2)
    expect(heightOf(null)).toBe(2)
    expect(heightOf(badDay)).toBe(2)
    expect(heightOf({ title: "services", items: [] })).toBe(2)
  })

  // The spinner owns its interval and clears it on unmount, so the frame that
  // carries data must no longer contain it — a spinner that outlived its row
  // would keep repainting the cockpit and hold timer-driven tests open. Read
  // from the first frame only, never after a tick, so the test does not wait
  // on the spinner's clock.
  it("drops the spinner the moment data arrives, at the same height", () => {
    const BRAILLE = /[⠀-⣿]/
    const instance = render(
      <StatusStripLine
        strip={undefined}
        label="services"
        width={100}
        now={NOW}
      />,
    )
    const loading = instance.lastFrame() ?? ""
    instance.rerender(
      <StatusStripLine strip={badDay} label="services" width={100} now={NOW} />,
    )
    const ready = instance.lastFrame() ?? ""
    instance.unmount()
    expect(loading).toMatch(BRAILLE)
    expect(ready).not.toMatch(BRAILLE)
    expect(heightOf(undefined)).toBe(heightOf(badDay))
  })

  it("shows the label then a bare spinner while the strip is undefined", () => {
    const frame = frameOf(
      <StatusStripLine strip={undefined} label="services" width={80} />,
    )
    expect(frame).toMatch(/^  services  [⠀-⣿]/m)
    expect(frame).not.toContain("loading")
    expect(frame).not.toContain("success")
  })

  it("says there is no signal when the host has nothing configured", () => {
    const frame = frameOf(
      <StatusStripLine strip={null} label="services" width={80} />,
    )
    expect(frame).toContain("? services  no signal / not configured")
  })

  it("draws the line under its padded title, fine count before the age", () => {
    // ink-testing-library's stdout is 100 columns, so the strip is kept
    // inside it rather than drawn at a width that would wrap.
    const strip: StatusStrip = {
      title: "services",
      at: AGED,
      items: [
        { key: "api", state: "ok" },
        { key: "billing", state: "fail", cause: "alerting" },
        { key: "auth", state: "ok" },
      ],
    }
    const frame = frameOf(
      <StatusStripLine strip={strip} width={100} now={NOW} />,
    )
    expect(frame.split("\n")[0]).toBe(
      `  services  billing: ${FAIL} alerting   ${OK} 2 fine   8m ago`,
    )
  })

  it("draws a frame no wider than its width when it has to shed", () => {
    const width = 60
    const frame = frameOf(
      <StatusStripLine strip={badDay} width={width} now={NOW} />,
    )
    for (const line of frame.split("\n"))
      expect([...line].length).toBeLessThanOrEqual(width)
  })
})
