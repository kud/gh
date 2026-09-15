import { describe, it, expect, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, COLS, labelPriority, impliedLabels } from "./inbox.js"
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

describe("impliedLabels", () => {
  it("names the labels a repo's convention puts on every issue there", () => {
    configureInbox({ impliedLabels: { "kud/plans": ["plan"] } })
    expect(impliedLabels("kud/plans")).toEqual(["plan"])
  })

  it("implies nothing for a repo the host did not name", () => {
    configureInbox({ impliedLabels: { "kud/plans": ["plan"] } })
    expect(impliedLabels("kud/gh")).toEqual([])
  })

  it("implies nothing when the host configured nothing", () => {
    expect(impliedLabels("kud/plans")).toEqual([])
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
  private buffer: string | null = null
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => {
    const d = this.buffer
    this.buffer = null
    return d
  }
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const settle = () => new Promise((r) => setImmediate(r))

const issue = (labels?: string[]): GHItem => ({
  kind: "issue",
  number: 17,
  title: "cockpit: show GitHub labels on rows",
  repo: "kud/gh",
  url: "https://github.com/kud/gh/issues/17",
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  // Depth 0, so the light row is exactly that: the ladder's rungs are measured
  // in columns and a tree prefix is columns like any other. `heavy` puts the
  // nesting back for the rows that are meant to be under pressure.
  depth: 0,
  ...(labels ? { labels } : {}),
})

const sidebar: Sidebar = {
  title: "Initiatives",
  rows: [{ key: "PROJ-1", label: "Something", live: 1, done: 0, total: 1 }],
}

// The shape that puts real pressure on the budget — a long title, a long repo,
// an author and unresolved threads — so the ladder gets past its first rungs.
// `issue` above is deliberately light: most of these specs are about WHICH
// labels are chosen, and a row under no pressure isolates that from the giving.
const heavy = (labels: string[]): GHItem => ({
  ...issue(labels),
  depth: 1,
  title:
    "PROJ-1125: Wire the analytics write key into the qa/uat/prod build pipeline",
  repo: "acme/web-app",
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
  const stdin = new FakeStdin()
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
      stdin: stdin as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  await settle()
  await settle()
  // The rail is closed at mount, so supplying one is not the same as showing
  // one — and it is the SHOWING that narrows the row this spec measures.
  if (withSidebar) {
    stdin.press("i")
    await settle()
    await settle()
  }
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

const frameFor = (labels: string[] | undefined, withSidebar = false) =>
  frameOf(issue(labels), withSidebar)

/* A whole section at once, so uniformity across rows is what is under test. */
const frameOfSection = async (items: GHItem[]) => {
  const sections: Section[] = [
    { id: "in-progress", label: "In progress", items },
  ]
  const stdout = new FakeStdout(COLS + 4, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections, login: "kud" })}
      title="cockpit"
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
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

/*
 * A label on EVERY row of a section classifies nothing — it is the section
 * header repeated once per row. `impliedLabels` already suppresses those, keyed
 * on repo, which is right for a repo convention and blind to uniformity that
 * comes from the QUERY: a `label:plan` view spanning five repos draws `plan` on
 * every row while only the repo in the config is exempt.
 *
 * What it costs is not a wasted cell but a wasted TIER. The row has three
 * neutrals and the label cell spends the middle one; a tone met on every single
 * row is calibrated to and filed as background, so a uniform label teaches the
 * reader that `secondary` means nothing — and the varied labels further down
 * inherit that.
 */
describe("a label every row in the section carries", () => {
  const row = (n: number, labels: string[], repo: string): GHItem => ({
    ...issue(labels),
    number: n,
    repo,
    url: `https://github.com/${repo}/issues/${n}`,
  })

  it("is suppressed even when no repo declares it implied", async () => {
    const frame = await frameOfSection([
      row(1, ["plan"], "kud/gh"),
      row(2, ["plan"], "kud/ink-ui"),
      row(3, ["plan"], "kud/jira-cli"),
    ])
    expect(impliedLabels("kud/gh")).not.toContain("plan")
    expect(frame).not.toContain(TAG)
  })

  it("keeps the labels that actually vary", async () => {
    configureInbox({ labelPriority: ["plan", "spike"] })
    const frame = await frameOfSection([
      row(1, ["plan", "spike"], "kud/gh"),
      row(2, ["plan"], "kud/ink-ui"),
    ])
    expect(frame).toContain("spike")
    expect(frame).not.toContain("plan")
  })

  /*
   * One row makes every label trivially uniform, and suppressing there would
   * hide the only classification on screen.
   */
  it("says nothing about uniformity in a section of one", async () => {
    const frame = await frameOfSection([row(1, ["plan"], "kud/gh")])
    expect(frame).toContain(`${TAG} plan`)
  })
})

/*
 * `6d (1w)` — active 6d ago, open for 1w. It was `6d · 1w`, on the argument
 * that the left value is by construction the smaller and that the invariant
 * teaches the order without a legend. Knowing which value is SMALLER is not
 * knowing which is WHICH, and the invariant is only visible inside one unit —
 * `6d · 1w` needs weeks converted to days before it even reads as ordered, and
 * cross-unit pairs are the common case rather than the edge.
 */
describe("the age cell", () => {
  it("subordinates the lifetime to the last-activity age", async () => {
    const frame = await frameOf(heavy([]), false)
    expect(frame).toContain("6d (1w)")
    expect(frame).not.toContain("6d · 1w")
  })

  it("collapses to one value when nothing has touched the row", async () => {
    const untouched = { ...heavy([]), activityAge: "1w", age: "1w" }
    const frame = await frameOf(untouched, false)
    expect(frame).toContain("1w")
    expect(frame).not.toContain("(1w)")
  })
})

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

  it("omits a label the repo's convention implies, before the two-slot cut", async () => {
    // Filtered after the slice, `plan` would take a slot and then vanish,
    // leaving `app:cockpit` alone on a row that also carries `spike`.
    configureInbox({
      labelPriority: ["app:*", "plan", "spike"],
      impliedLabels: { "kud/gh": ["plan"] },
    })
    const frame = await frameFor(["spike", "plan", "app:cockpit"])
    expect(frame).toContain(`${TAG} app:cockpit, spike`)
    expect(frame).not.toContain("plan")
  })

  it("draws no cell at all when every label the row carries is implied", async () => {
    // A bare glyph would say "classified" with nothing behind it; the row
    // should look exactly like an unlabelled one.
    configureInbox({ impliedLabels: { "kud/gh": ["plan"] } })
    expect(await frameFor(["plan"])).not.toContain(TAG)
  })

  it("still shows the same label on a repo whose convention does not imply it", async () => {
    configureInbox({ impliedLabels: { "kud/plans": ["plan"] } })
    expect(await frameFor(["plan"])).toContain(`${TAG} plan`)
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
   * The rail is a SIDEBAR_COLS step, and the two rungs either side of the repo
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
    expect(tight).toContain("PROJ-1125: Wire")
    expect(tight).toContain("6d (1w)")
  })
})
