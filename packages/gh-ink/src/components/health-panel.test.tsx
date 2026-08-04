import { describe, expect, it } from "vitest"
import React from "react"
import { render } from "ink-testing-library"
import { HealthPanel } from "./health-panel.js"
import type { PrHealthData } from "@kud/gh"

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

    expect(rowOf(lines, "Reviews")).toBe(rowOf(lines, "Checks") + 1)
    expect(rowOf(lines, "Merge")).toBe(rowOf(lines, "Reviews") + 1)
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

    // Checks summary, its two check rows, then a blank, then Reviews.
    expect(rowOf(lines, "Reviews")).toBe(rowOf(lines, "Checks") + 4)
    expect(lines[rowOf(lines, "Reviews") - 1]).toBe("")

    // Reviews summary, its one reviewer row, then a blank, then Merge.
    expect(rowOf(lines, "Merge")).toBe(rowOf(lines, "Reviews") + 3)
    expect(lines[rowOf(lines, "Merge") - 1]).toBe("")
  })
})
