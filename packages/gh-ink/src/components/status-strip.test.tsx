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
  `web: ? no data   cron: ? no data`

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
    const { issues, success } = stripRows(
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
    expect(issues).toBe(`a: ${FAIL} errors · slow   b: ${WARN} errors`)
    expect(success).toBe(`${OK} c`)
  })

  it("says `no data` for unknown itself, ignoring any cause", () => {
    const { issues } = stripRows(
      {
        title: "services",
        items: [{ key: "web", state: "unknown", cause: "x" }],
      },
      200,
    )
    expect(issues).toBe("web: ? no data")
  })

  it("pulls a healthy service with a red build out of row 2 and names it", () => {
    const { issues, success } = stripRows(
      {
        title: "services",
        items: [
          { key: "api", state: "ok" },
          { key: "payments", state: "ok", alarm: true },
        ],
      },
      200,
    )
    expect(issues).toBe(`payments: ${OK} · build ${FAIL}`)
    expect(success).toBe(`${OK} api`)
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

  it("says `all N fine` only when nothing else would be on row 1", () => {
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
    expect(rows.success).toBe(`${OK} api · web · auth`)
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
    expect(rows.success).toBe("nothing measured")
  })

  it("draws every name bold in the default foreground, whatever its state", () => {
    const { spans } = stripRows(badDay, 200, NOW)
    const names = new Set(badDay.items.map((i) => i.key))
    const nameSpans = [...spans.issues, ...spans.success].filter((s) =>
      names.has(s.text),
    )
    expect(nameSpans).toHaveLength(badDay.items.length)
    for (const span of nameSpans) {
      expect(span.bold).toBe(true)
      expect(span.color).toBeUndefined()
      expect(span.dim).toBeFalsy()
    }
  })

  it("colours the cross bold red, the warning bold amber, and no data grey", () => {
    const { spans } = stripRows(badDay, 200, NOW)
    const fail = spans.issues.find((s) => s.text === FAIL)
    const warn = spans.issues.find((s) => s.text === WARN)
    const noData = spans.issues.find((s) => s.text === "? no data")
    expect(fail).toMatchObject({ color: colors.error, bold: true })
    expect(warn).toMatchObject({ color: colors.warning, bold: true })
    expect(noData).toMatchObject({ dim: true })
  })
})

describe("stripRows: narrow row 1 sheds the least actionable first", () => {
  const noUnknowns =
    `billing: ${FAIL} alerting   search: ${WARN} slow · build ${FAIL}   ` +
    `events: ${WARN} errors   payments: ${OK} · build ${FAIL}   ? 2`
  const noBuilds =
    `billing: ${FAIL} alerting   search: ${WARN} slow · build ${FAIL}   ` +
    `events: ${WARN} errors   build ${FAIL} 1   ? 2`
  // `search` was a warning with a red build: folding it counts it under both,
  // so the build it carried is never dropped with its name.
  const noWarns = `billing: ${FAIL} alerting   ${WARN} 2   build ${FAIL} 2   ? 2`
  const nothingNamed = `${FAIL} 1   ${WARN} 2   build ${FAIL} 2   ? 2`

  it("names everything while it fits", () => {
    expect(stripRows(badDay, fits(fullIssues), NOW).issues).toBe(fullIssues)
  })

  it("1. folds the no-data items into `? N` first", () => {
    const rows = stripRows(badDay, fits(fullIssues) - 1, NOW)
    expect(rows.issues).toBe(noUnknowns)
    expect(stripRows(badDay, fits(noUnknowns), NOW).issues).toBe(noUnknowns)
  })

  it("2. then the healthy-with-red-build items into `build ✕ N`", () => {
    expect(stripRows(badDay, fits(noUnknowns) - 1, NOW).issues).toBe(noBuilds)
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
})

describe("stripRows: row 2 is the whole list or the count", () => {
  const strip: StatusStrip = {
    title: "services",
    items: [
      { key: "api", state: "ok" },
      { key: "web", state: "fail" },
      { key: "auth", state: "ok" },
      { key: "queue", state: "ok" },
    ],
  }
  const list = `${OK} api · auth · queue`

  it("lists every fine name behind one shared tick while it fits", () => {
    expect(stripRows(strip, TITLES + list.length).success).toBe(list)
  })

  it("drops to the count alone, never a partial list", () => {
    expect(stripRows(strip, TITLES + list.length - 1).success).toBe(
      `${OK} 3 services`,
    )
  })

  it("says `none` when things were measured and nothing is fine", () => {
    const { success } = stripRows(
      { title: "services", items: [{ key: "web", state: "warn" }] },
      200,
    )
    expect(success).toBe("none")
  })
})

describe("StatusStripLine", () => {
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

  it("keeps one height — two lines and a margin — loading, absent and ready", () => {
    expect(heightOf(undefined)).toBe(3)
    expect(heightOf(null)).toBe(3)
    expect(heightOf(badDay)).toBe(3)
    expect(heightOf({ title: "services", items: [] })).toBe(3)
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

  it("shows a loading state on both rows while the strip is undefined", () => {
    const frame = frameOf(
      <StatusStripLine strip={undefined} label="services" width={80} />,
    )
    expect(frame).toContain("services  loading…")
    expect(frame).toContain("· success")
  })

  it("says there is no signal when the host has nothing configured", () => {
    const frame = frameOf(
      <StatusStripLine strip={null} label="services" width={80} />,
    )
    expect(frame).toContain("? services  no signal / not configured")
  })

  it("draws the issues row and the success row under padded titles", () => {
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
    const [issues, success] = frame.split("\n")
    expect(issues).toBe(`  services  billing: ${FAIL} alerting   8m ago`)
    expect(success).toBe(`  success   ${OK} api · auth`)
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
