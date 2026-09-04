import { describe, it, expect, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, COLS, labelPriority } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"
import { configureInbox, resetInboxConfig } from "./config.js"
import type { Sidebar } from "../components/side-panel.js"

/*
 * Labels are the second axis on a row. Health has eleven states, a glyph each
 * and a legend; labels had nothing, so a `plan`-labelled issue and an ordinary
 * one were indistinguishable — on a worklist whose rows ARE plan issues.
 *
 * Two properties are worth pinning and they pull opposite ways. The row must
 * SHOW the label, and the row must still FIT: `narrow.test.tsx` is the account
 * of what a row one column too wide does to the frame. So the ranking is
 * asserted as a function, and the fitting through the rail, which is the only
 * lever that moves the width a row actually reads (see that file for why a
 * smaller FakeStdout does not).
 */

const TAG = "\u{f02b}"

afterEach(() => resetInboxConfig())

describe("labelPriority", () => {
  it("ranks by position in the host's list", () => {
    configureInbox({ labelPriority: ["plan", "spike"] })
    expect(labelPriority("plan")).toBe(0)
    expect(labelPriority("spike")).toBe(1)
  })

  it("matches a trailing * by prefix, so app:* need not be enumerated", () => {
    configureInbox({ labelPriority: ["plan", "app:*"] })
    expect(labelPriority("app:cockpit")).toBe(1)
    expect(labelPriority("app:ambre")).toBe(1)
  })

  it("does not let a * entry match the bare prefix's neighbours", () => {
    configureInbox({ labelPriority: ["app:*"] })
    expect(labelPriority("appearance")).toBe(Infinity)
  })

  /*
   * Infinity rather than the list's length, so every unranked label shares one
   * rank and the name tiebreak orders them among themselves. Identical
   * behaviour today; it stops being identical the first time a rank is compared
   * against anything but another rank.
   */
  it("gives every unranked label the same last rank", () => {
    configureInbox({ labelPriority: ["plan"] })
    expect(labelPriority("bug")).toBe(Infinity)
    expect(labelPriority("chore")).toBe(Infinity)
  })

  it("ranks nothing when the host configured nothing", () => {
    expect(labelPriority("plan")).toBe(Infinity)
  })
})

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
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => null
}

const settle = () => new Promise((r) => setImmediate(r))

const issue = (labels?: string[]): GHItem => ({
  kind: "issue",
  number: 17,
  title: "cockpit: show GitHub labels on rows",
  repo: "kud/plans",
  url: "https://github.com/kud/plans/issues/17",
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  depth: 1,
  ...(labels ? { labels } : {}),
})

const sidebar: Sidebar = {
  title: "Initiatives",
  rows: [{ key: "ACC-1", label: "Something", live: 1, done: 0, total: 1 }],
}

// The shape that puts real pressure on the budget — a long title, a long repo,
// an author and unresolved threads — so the ladder gets past its first rungs.
// `issue` above is deliberately light: most of these specs are about WHICH
// labels are chosen, and a row under no pressure isolates that from the giving.
const heavy = (labels: string[]): GHItem => ({
  ...issue(labels),
  title:
    "ACC-11125: Wire the Segment write key into the qa/uat/prod build pipeline",
  repo: "theorchard/frontend-royalties",
  author: "someone-else",
  unresolved: 2,
  activityAge: "6d",
  age: "1w",
})

const frameOf = async (item: GHItem, withSidebar: boolean) => {
  const sections: Section[] = [
    { id: "in-progress", label: "In progress", items: [item] },
  ]
  const stdout = new FakeStdout(COLS + 4, 30)
  const instance = render(
    <App
      fetcher={async () => ({
        sections,
        login: "kud",
        ...(withSidebar ? { sidebar } : {}),
      })}
      title="cockpit"
    />,
    {
      stdout: stdout as never,
      stdin: new FakeStdin() as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  await settle()
  await settle()
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

const frameFor = (labels: string[] | undefined, withSidebar = false) =>
  frameOf(issue(labels), withSidebar)

describe("a row carrying labels", () => {
  it("draws nothing at all — glyph included — when none were fetched", async () => {
    // `minimal` omits the selection, so the field VANISHES rather than arriving
    // empty. An unlabelled row and an unasked one must look the same.
    expect(await frameFor(undefined)).not.toContain(TAG)
  })

  it("draws nothing when the item genuinely has none", async () => {
    expect(await frameFor([])).not.toContain(TAG)
  })

  it("shows what the host ranked first, not what sorts first", async () => {
    // The motivating case, and the one alphabetical gets wrong: on kud/plans
    // every issue carries `plan` plus an `app:` label, and `app:cockpit` beats
    // `plan` alphabetically — dropping the one label that must never drop.
    configureInbox({ labelPriority: ["plan", "spike", "app:*"] })
    const frame = await frameFor(["app:cockpit", "plan"])
    expect(frame).toContain(`${TAG} plan, app:cockpit`)
  })

  it("shows two at most, however many the row carries", async () => {
    configureInbox({ labelPriority: ["plan", "spike"] })
    const frame = await frameFor(["chore", "spike", "plan", "bug"])
    expect(frame).toContain(`${TAG} plan, spike`)
    expect(frame).not.toContain("chore")
    expect(frame).not.toContain("bug")
  })

  it("falls back to name order when the host ranked nothing", async () => {
    const frame = await frameFor(["plan", "bug"])
    expect(frame).toContain(`${TAG} bug, plan`)
  })

  /*
   * The give order is `author → labels[1] → threads → labels[0] → repo → age`,
   * and the label cell is the one participant on two rungs of it — the second
   * label is the most speculative thing on the row, so it goes early, while the
   * first survives the thread count.
   *
   * The repo outlives both, which is the one place a label loses to something
   * that looks like mere context: on a nested row the repo is POSITIONAL. It
   * says the row is not where the header above it claims, so dropping it
   * misattributes the row — a correctness failure, where a dropped label is
   * only less to go on.
   */
  it("gives up the second label while the row is still under light pressure", async () => {
    configureInbox({ labelPriority: ["plan", "app:*"] })
    const tight = await frameFor(["plan", "app:cockpit"], true)
    expect(tight).toContain(`${TAG} plan`)
    expect(tight).not.toContain("app:cockpit")
  })

  /*
   * The rail is a forty-column step, and the two rungs either side of the repo
   * are narrower than that — so no frame this harness can produce shows the
   * label cell gone while the repo is still standing. That ordering is asserted
   * by the ladder array itself, and what is pinned here is the pair of
   * properties a frame CAN show: the cell goes entirely under real pressure,
   * and it goes as context rather than taking the subject with it.
   */
  it("sheds the whole cell under real pressure, keeping title and age", async () => {
    configureInbox({ labelPriority: ["plan", "app:*"] })
    const roomy = await frameOf(heavy(["plan", "app:cockpit"]), false)
    const tight = await frameOf(heavy(["plan", "app:cockpit"]), true)
    expect(roomy).toContain(`${TAG} plan`)
    expect(tight).not.toContain(TAG)
    // The title is elided in the MIDDLE, so assert its head rather than a span
    // truncation would cut through.
    expect(tight).toContain("ACC-11125: Wire the Seg")
    expect(tight).toContain("6d · 1w")
  })
})
