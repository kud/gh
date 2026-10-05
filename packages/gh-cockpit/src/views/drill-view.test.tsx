import { describe, expect, it } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Text } from "ink"
import { DrillView } from "./drill-view.js"

// The `not in inbox` tag: an item opened from the launcher that no list holds
// says so beside its title, and an item opened from the list says nothing.
// PrView and IssueView each pass `tag` off `item.notInInbox`; that the flag
// reaches the item at all is pinned in gh-ink's launcher-lookup.test.tsx.
class FakeStdout extends EventEmitter {
  frames: string[] = []
  columns = 100
  rows = 20
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

const frameOf = (tag?: string) => {
  const stdout = new FakeStdout()
  const instance = render(
    <DrillView
      title="#2926 · acme/api-gateway"
      subtitle="Tighten the retry budget"
      tag={tag}
      hints={[["esc", "back"]]}
    >
      <Text>body</Text>
    </DrillView>,
    { stdout: stdout as never, debug: true, patchConsole: false },
  )
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

describe("DrillView's tag", () => {
  it("draws beside the title line", () => {
    const line = frameOf("not in inbox")
      .split("\n")
      .find((l) => l.includes("Title: Tighten the retry budget"))
    expect(line).toContain("not in inbox")
  })

  it("draws nothing when there is no tag", () => {
    expect(frameOf()).not.toContain("not in inbox")
  })
})
