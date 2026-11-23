import { describe, expect, it, vi } from "vitest"
import React from "react"
import { render } from "ink-testing-library"
import chalk from "chalk"
import { colors } from "@kud/ink-ui"
import { HealthPanel, orderChecks } from "./health-panel.js"
import type { PrCheck, PrHealthData } from "@kud/gh"

// The retrigger is the one action a test can provoke without a confirm, and it
// has to fail on cue: the flash colour under test is the failure's.
vi.mock("@kud/gh", async (orig) => ({
  ...(await orig<typeof import("@kud/gh")>()),
  rerunFailedRun: vi.fn(async () => {
    throw new Error("nope")
  }),
}))

const dataWith = (over: Partial<PrHealthData> = {}): PrHealthData => ({
  statusCheckRollup: [],
  reviews: [],
  reviewDecision: null,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  author: { login: "kud" },
  ...over,
})

const renderPanel = (data: PrHealthData) =>
  (
    render(
      <HealthPanel
        repo="kud/gh"
        number={1}
        data={data}
        error={null}
        reload={() => {}}
        onOpenCheck={() => {}}
      />,
    ).lastFrame() ?? ""
  )
    .split("\n")
    .map((l) => l.trimEnd())

// Row index of each summary, so a test asserts on the gap BETWEEN them rather
// than on absolute line numbers that shift whenever a list grows.
const rowOf = (lines: string[], label: string) =>
  lines.findIndex((l) => l.trimStart().startsWith(label))

describe("HealthPanel spacing", () => {
  it("packs the summaries together when there is no list to separate from", () => {
    const lines = renderPanel(dataWith())

    expect(rowOf(lines, "Checks")).toBe(rowOf(lines, "Merge") + 1)
    expect(rowOf(lines, "Reviews")).toBe(rowOf(lines, "Checks") + 1)
  })

  it("keeps a blank line when a list sits above the summary", () => {
    const lines = renderPanel(
      dataWith({
        statusCheckRollup: [
          { name: "build", conclusion: "SUCCESS" },
          { name: "test", conclusion: "SUCCESS" },
        ] as PrHealthData["statusCheckRollup"],
        reviews: [
          { author: { login: "alice" }, state: "APPROVED" },
        ] as PrHealthData["reviews"],
      }),
    )

    // Merge has no list of its own, so Checks follows it directly.
    expect(rowOf(lines, "Checks")).toBe(rowOf(lines, "Merge") + 1)

    // Checks summary, its two check rows, then a blank, then Reviews.
    expect(rowOf(lines, "Reviews")).toBe(rowOf(lines, "Checks") + 4)
    expect(lines[rowOf(lines, "Reviews") - 1]).toBe("")
  })
})

describe("HealthPanel order", () => {
  // Merge is the question the panel is opened to answer, so it leads.
  it("draws Merge first, with today's words", () => {
    const lines = renderPanel(dataWith({ mergeStateStatus: "BLOCKED" }))
    expect(rowOf(lines, "Merge")).toBe(0)
    expect(lines[0]).toContain("blocked")
  })

  it("sorts checks worst first and keeps every row", () => {
    const checks: PrCheck[] = [
      { name: "pass", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "skip", status: "COMPLETED", conclusion: "SKIPPED" },
      { name: "run", status: "IN_PROGRESS", conclusion: null },
      { name: "gate", status: "COMPLETED", conclusion: "ACTION_REQUIRED" },
      { name: "kill", status: "COMPLETED", conclusion: "CANCELLED" },
      { name: "fail", status: "COMPLETED", conclusion: "FAILURE" },
      { name: "neutral", status: "COMPLETED", conclusion: "NEUTRAL" },
      { name: "queue", status: "QUEUED", conclusion: null },
    ]
    expect(orderChecks(checks).map((c) => c.name)).toEqual([
      "fail",
      "gate",
      "kill",
      "run",
      "queue",
      "skip",
      "neutral",
      "pass",
    ])

    const lines = renderPanel(dataWith({ statusCheckRollup: checks }))
    // The cursor opens on the failure, and no pass is folded away.
    expect(lines.find((l) => l.includes("❯"))).toContain("fail")
    for (const c of checks)
      expect(lines.some((l) => l.endsWith(` ${c.name}`) || l.includes(` ${c.name} `))).toBe(true)
  })
})

describe("HealthPanel glyphs", () => {
  const glyphOf = (lines: string[], name: string) =>
    lines
      .find((l) => new RegExp(`\\s${name}(\\s|$)`).test(l))
      ?.replace("❯", " ")
      .trim()[0]

  it("separates still running, no verdict, and the verdicts", () => {
    const lines = renderPanel(
      dataWith({
        statusCheckRollup: [
          { name: "a", status: "IN_PROGRESS", conclusion: null },
          { name: "b", status: "QUEUED", conclusion: null },
          { name: "c", status: "COMPLETED", conclusion: "SKIPPED" },
          { name: "d", status: "COMPLETED", conclusion: "NEUTRAL" },
          { name: "e", status: "COMPLETED", conclusion: "CANCELLED" },
          { name: "f", status: "COMPLETED", conclusion: "SUCCESS" },
          { name: "g", status: "COMPLETED", conclusion: "FAILURE" },
        ],
      }),
    )
    expect(glyphOf(lines, "a")).toBe("◌")
    expect(glyphOf(lines, "b")).toBe("◌")
    expect(glyphOf(lines, "c")).toBe("-")
    expect(glyphOf(lines, "d")).toBe("-")
    expect(glyphOf(lines, "e")).toBe("-")
    expect(glyphOf(lines, "f")).toBe("✓")
    expect(glyphOf(lines, "g")).toBe("✗")
  })

  // `·` is the separator in every summary; it must never also be a state.
  it("spends · on separators only", () => {
    const lines = renderPanel(
      dataWith({
        statusCheckRollup: [
          { name: "a", status: "IN_PROGRESS", conclusion: null },
        ],
        reviews: [{ author: { login: "bob" }, state: "COMMENTED" }],
        reviewDecision: "REVIEW_REQUIRED",
        mergeStateStatus: "UNKNOWN",
      }),
    )
    for (const l of lines) {
      const mark = l.replace("❯", " ").trim()[0]
      expect(mark).not.toBe("·")
      const summary = l.match(/^\s+(Merge|Checks|Reviews)\s+(\S)/)
      if (summary) expect(summary[2]).not.toBe("·")
    }
  })

  it("does not tick a list in which every check was cancelled", () => {
    const lines = renderPanel(
      dataWith({
        statusCheckRollup: [
          { name: "a", status: "COMPLETED", conclusion: "CANCELLED" },
          { name: "b", status: "COMPLETED", conclusion: "CANCELLED" },
        ],
      }),
    )
    const checks = lines[rowOf(lines, "Checks")]
    expect(checks).not.toContain("✓")
    expect(checks).toMatch(/Checks\s+-\s+0 passed · 2 cancelled/)
  })
})

describe("HealthPanel flash", () => {
  const tick = () => new Promise((r) => setTimeout(r, 30))

  // `✗ retrigger CI failed` was drawn in the success green.
  it("draws a failed action in the error colour", async () => {
    const level = chalk.level
    chalk.level = 3
    try {
      const app = render(
        <HealthPanel
          repo="kud/gh"
          number={1}
          data={dataWith({
            statusCheckRollup: [
              {
                name: "test",
                status: "COMPLETED",
                conclusion: "FAILURE",
                detailsUrl: "https://github.com/kud/gh/actions/runs/42/job/1",
              },
            ],
          })}
          error={null}
          reload={() => {}}
          onOpenCheck={() => {}}
        />,
      )
      await tick()
      app.stdin.write("r")
      let frame = ""
      for (let i = 0; i < 20 && !frame.includes("failed"); i++) {
        await tick()
        frame = app.lastFrame() ?? ""
      }
      const line = frame.split("\n").find((l) => l.includes("retrigger CI failed"))
      expect(line).toBeDefined()
      expect(line).toContain(chalk.hex(colors.error)("x").slice(0, -6))
      expect(line).not.toContain(chalk.hex(colors.success)("x").slice(0, -6))
      app.unmount()
    } finally {
      chalk.level = level
    }
  })
})
