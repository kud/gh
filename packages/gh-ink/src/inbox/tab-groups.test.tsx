import { describe, expect, it } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Text } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(
    public columns: number,
    public rows: number,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

class FakeStdin extends EventEmitter {
  isTTY = true
  private buffer: string | null = null
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => {
    const data = this.buffer
    this.buffer = null
    return data
  }
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const pr = (number: number): GHItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const settle = () => new Promise((resolve) => setImmediate(resolve))

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

// The tab strip line is the one containing all tab labels. Extract it to
// check for dividers without false positives from frame borders.
const tabLine = (output: string): string => {
  const lines = output.split("\n")
  return lines.find((l) => l.includes("QA") && l.includes("Off board")) ?? ""
}

// Check if a divider appears between two specific tab labels in the tab line.
const hasDividerBetween = (tabs: string, leftLabel: string, rightLabel: string): boolean => {
  const leftIdx = tabs.indexOf(leftLabel)
  const rightIdx = tabs.indexOf(rightLabel)
  if (leftIdx === -1 || rightIdx === -1) return false
  const between = tabs.slice(leftIdx + leftLabel.length, rightIdx)
  return between.includes("│")
}

const mount = async (sections: Section[]) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      title="cockpit"
      fetcher={async () => ({ sections, login: "kud" })}
    />,
    {
      stdout: stdout as never,
      stdin: stdin as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  await settle()
  await settle()
  return {
    frame: () => stripAnsi(stdout.lastFrame()),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("tab groups", () => {
  it("renders a divider when group changes between neighbouring tabs", async () => {
    const sections: Section[] = [
      { id: "qa", label: "QA", items: [pr(1), pr(2)], group: "work" },
      { id: "off-board", label: "Off board", items: [pr(3)], group: "work" },
      { id: "my-prs", label: "My PRs", items: [pr(4)], group: "personal" },
    ]

    const { frame, done } = await mount(sections)
    const output = frame()
    const tabs = tabLine(output)

    done()

    expect(tabs).toContain("QA")
    expect(tabs).toContain("Off board")
    expect(tabs).toContain("My PRs")
    // The divider character │ should appear between "Off board" and "My PRs"
    // because their group values differ ("work" vs "personal")
    expect(hasDividerBetween(tabs, "Off board", "My PRs")).toBe(true)
  })

  it("renders no divider when all tabs share the same group", async () => {
    const sections: Section[] = [
      { id: "qa", label: "QA", items: [pr(1)], group: "work" },
      { id: "off-board", label: "Off board", items: [pr(2)], group: "work" },
      { id: "my-prs", label: "My PRs", items: [pr(3)], group: "work" },
    ]

    const { frame, done } = await mount(sections)
    const output = frame()
    const tabs = tabLine(output)

    done()

    expect(tabs).toContain("QA")
    expect(tabs).toContain("Off board")
    expect(tabs).toContain("My PRs")
    // No divider should appear between tabs since all tabs have the same group
    expect(hasDividerBetween(tabs, "QA", "Off board")).toBe(false)
    expect(hasDividerBetween(tabs, "Off board", "My PRs")).toBe(false)
  })

  it("renders no divider when no groups are set", async () => {
    const sections: Section[] = [
      { id: "qa", label: "QA", items: [pr(1)] },
      { id: "off-board", label: "Off board", items: [pr(2)] },
      { id: "my-prs", label: "My PRs", items: [pr(3)] },
    ]

    const { frame, done } = await mount(sections)
    const output = frame()
    const tabs = tabLine(output)

    done()

    expect(tabs).toContain("QA")
    expect(tabs).toContain("Off board")
    expect(tabs).toContain("My PRs")
    // No divider should appear between tabs since no groups are set
    expect(hasDividerBetween(tabs, "QA", "Off board")).toBe(false)
    expect(hasDividerBetween(tabs, "Off board", "My PRs")).toBe(false)
  })

  it("renders divider only at group boundaries, not within a group", async () => {
    const sections: Section[] = [
      { id: "qa", label: "QA", items: [pr(1)], group: "work" },
      { id: "review", label: "Review", items: [pr(2)], group: "work" },
      { id: "off-board", label: "Off board", items: [pr(3)], group: "work" },
      { id: "my-prs", label: "My PRs", items: [pr(4)], group: "personal" },
      { id: "drafts", label: "Drafts", items: [pr(5)], group: "personal" },
    ]

    const { frame, done } = await mount(sections)
    const output = frame()
    const tabs = tabLine(output)

    done()

    expect(tabs).toContain("QA")
    expect(tabs).toContain("Review")
    expect(tabs).toContain("Off board")
    expect(tabs).toContain("My PRs")
    expect(tabs).toContain("Drafts")
    // Divider only at the group boundary: between "Off board" (work) and "My PRs" (personal)
    expect(hasDividerBetween(tabs, "QA", "Review")).toBe(false)
    expect(hasDividerBetween(tabs, "Review", "Off board")).toBe(false)
    expect(hasDividerBetween(tabs, "Off board", "My PRs")).toBe(true)
    expect(hasDividerBetween(tabs, "My PRs", "Drafts")).toBe(false)
  })
})