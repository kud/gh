import { describe, expect, it, vi } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Box } from "ink"
import { ScrollView, type StyledLine } from "@kud/ink-ui"

// Inside the shell `useChrome` returns true and DrillView draws only its body
// into the overlay band, a fixed-height column. Standing the hook in for the
// shell keeps the test to the one thing pinned: the body fills that band.
vi.mock("../lib.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib.js")>()),
  useChrome: () => true,
}))

const { DrillView } = await import("./drill-view.js")

class FakeStdout extends EventEmitter {
  frames: string[] = []
  columns = 80
  rows = 30
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.filter((f) => f.trim()).at(-1) ?? ""
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("DrillView inside the shell", () => {
  it("gives a ScrollView body the band's height, not one row", async () => {
    const lines: StyledLine[] = Array.from({ length: 53 }, (_, i) => ({
      text: `line ${i + 1}`,
    }))
    const stdout = new FakeStdout()
    const instance = render(
      <Box flexDirection="column" height={20} overflow="hidden">
        <DrillView title="#2995 · acme/api-gateway" hints={[]}>
          <ScrollView lines={lines} isActive={false} />
        </DrillView>
      </Box>,
      { stdout: stdout as never, debug: true, patchConsole: false },
    )
    await tick()
    await tick()
    const frame = stdout.lastFrame()
    instance.unmount()
    instance.cleanup()

    expect(frame).toContain("line 10")
    expect(frame).not.toContain("1–1 / 53")
  })
})
