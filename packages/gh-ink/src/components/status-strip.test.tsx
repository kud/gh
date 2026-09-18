import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import {
  StatusStripLine,
  ageLabel,
  stripGlyph,
  stripLayout,
  type StatusStrip,
} from "./status-strip.js"

const frameOf = (node: React.ReactElement) => render(node).lastFrame() ?? ""

describe("stripGlyph", () => {
  it("gives every state its own shape, not only its own colour", () => {
    expect(stripGlyph("ok")[0]).toBe("✓")
    expect(stripGlyph("warn")[0]).toBe("!")
    expect(stripGlyph("fail")[0]).toBe("✗")
    expect(stripGlyph("unknown")[0]).toBe("○")
  })
})

describe("ageLabel", () => {
  it("says nothing when there is no snapshot yet", () => {
    expect(ageLabel(undefined)).toBe("")
  })

  it("counts in seconds under a minute", () => {
    const now = 1_000_000
    expect(ageLabel(now - 5_000, now)).toBe("5s")
  })

  it("switches to rounded minutes once a minute has passed", () => {
    const now = 1_000_000
    expect(ageLabel(now - 90_000, now)).toBe("2m")
  })

  it("switches to rounded hours once an hour has passed", () => {
    const now = 1_000_000
    expect(ageLabel(now - 2 * 3_600_000, now)).toBe("2h")
  })
})

describe("stripLayout", () => {
  const wideEnough: StatusStrip = {
    title: "services",
    items: [
      { key: "api", state: "ok" },
      { key: "db", state: "fail" },
      { key: "queue", state: "warn" },
    ],
  }

  // "✓ api  ✗ db  ! queue" is 20 chars; fixed is 12 ("  services  "). The
  // switch happens exactly at 32 — pin both sides of it.
  it("names every item, with its own glyph, once the row has room", () => {
    const { parts, summary } = stripLayout(wideEnough, 32)
    expect(parts).toEqual(wideEnough.items)
    expect(summary).toContain("✓ api")
    expect(summary).toContain("✗ db")
    expect(summary).toContain("! queue")
  })

  it("drops to counts one column short of the same row", () => {
    const { parts } = stripLayout(wideEnough, 31)
    expect(parts).toBeNull()
  })

  it("names the failure before folding the oks into a count", () => {
    const { parts, summary } = stripLayout(wideEnough, 31)
    expect(parts).toBeNull()
    // The one fail is still named; the ok and the warn are only counted.
    expect(summary).toContain("✗ db")
    expect(summary).toContain("1 ✓")
    expect(summary).toContain("1 !")
    expect(summary).not.toContain("✓ api")
    expect(summary).not.toContain("! queue")
  })

  // Four bad items and a row too narrow even for the worst one alone: only
  // the single worst is named, the rest of the fails and the warns are
  // counted rather than silently dropped.
  it("names worst-first and counts the rest when even the failures don't fit", () => {
    const crowded: StatusStrip = {
      title: "svc",
      items: [
        { key: "aaa", state: "fail" },
        { key: "bbb", state: "fail" },
        { key: "ccc", state: "warn" },
        { key: "ddd", state: "warn" },
      ],
    }
    const { parts, summary } = stripLayout(crowded, 24)
    expect(parts).toBeNull()
    expect(summary).toBe("1 ✗ · 2 ! · ✗ aaa")
  })

  it("carries the alarm mark on an item that has one", () => {
    const alarmed: StatusStrip = {
      title: "x",
      items: [{ key: "payments", state: "ok", alarm: true }],
    }
    const { summary } = stripLayout(alarmed, 200)
    expect(summary).toContain("✓ payments▲")
  })

  it("draws unknown as its own hollow mark and never counts it as ok", () => {
    const mixed: StatusStrip = {
      title: "x",
      items: [
        { key: "a", state: "unknown" },
        { key: "b", state: "ok" },
      ],
    }
    const { summary } = stripLayout(mixed, 5)
    expect(summary).toBe("1 ✓ · 1 ○")
  })

  it("appends the age once a snapshot time is given", () => {
    const now = 1_000_000
    const stamped: StatusStrip = { ...wideEnough, at: now - 5_000 }
    const { age } = stripLayout(stamped, 200, now)
    expect(age).toBe("5s")
  })
})

describe("StatusStripLine", () => {
  it("shows a loading state while the strip is undefined", () => {
    const frame = frameOf(
      <StatusStripLine strip={undefined} label="services" width={80} />,
    )
    expect(frame).toContain("services  loading…")
  })

  it("says there is no signal when the host has nothing configured", () => {
    const frame = frameOf(
      <StatusStripLine strip={null} label="services" width={80} />,
    )
    expect(frame).toContain("no signal / not configured")
  })

  it("renders a ready strip's title and items", () => {
    const strip: StatusStrip = {
      title: "services",
      items: [
        { key: "api", state: "ok" },
        { key: "db", state: "fail" },
      ],
    }
    const frame = frameOf(<StatusStripLine strip={strip} width={80} />)
    expect(frame).toContain("services")
    expect(frame).toContain("api")
    expect(frame).toContain("db")
  })

  it("draws the age suffix on a stamped, ready strip", () => {
    const now = 1_000_000
    const strip: StatusStrip = {
      title: "services",
      items: [{ key: "api", state: "ok" }],
      at: now - 90_000,
    }
    const frame = frameOf(
      <StatusStripLine strip={strip} width={80} now={now} />,
    )
    expect(frame).toContain("2m")
  })
})
