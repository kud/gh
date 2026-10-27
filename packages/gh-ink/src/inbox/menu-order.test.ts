import { describe, expect, it } from "vitest"
import { buildActions, menuRowsOf, isMenuGap } from "./inbox.js"
import type { Action, GHItem, TaskRow } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// The menu reads Act → Open → Switch → Copy → Quiet → Close, one blank row
// between groups, the destructive pair always last. Closing is the one verb
// that cannot be taken back, so nothing — Land and Submit included — may follow
// it; Land and Submit came after "Close PR" until 2026-10-05, which put the
// irreversible verb between the reader and the one they opened the menu for.

const pr: GHItem = {
  kind: "pr",
  number: 42,
  title: "a row",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/pull/42",
  health: "none",
  standing: "queued",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  branch: "fix/a-row",
}

const issue: GHItem = {
  kind: "issue",
  number: 7,
  title: "an issue",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/issues/7",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
}

const task: TaskRow = {
  kind: "task",
  key: "SHOP-1234",
  ticket: "SHOP-1234",
  summary: "a ticket",
  url: "https://example.com/browse/SHOP-1234",
  status: "In progress",
  age: "2d",
  indent: false,
}

const extension = (
  id: string,
  opts: Partial<InboxExtension> = {},
): InboxExtension =>
  ({
    id,
    title: id,
    key: id.charAt(0).toLowerCase(),
    hint: id.toLowerCase(),
    scope: "item",
    body: () => null,
    ...opts,
  }) as unknown as InboxExtension

// Labels and groups in display order, for a menu with every row switched on.
const layoutOf = (actions: Action[]): [string, string | undefined][] =>
  menuRowsOf(actions)
    .filter((row) => !isMenuGap(row))
    .map((row) => [(row as Action).label, (row as Action).group])

describe("the PR action menu's order", () => {
  const all = () =>
    buildActions(pr, "kud", () => {}, undefined, undefined, undefined, () => {}, () => {}, () => true, {
      extensions: [
        extension("Land", { key: "L", hint: "land", menuGroup: "act" }),
        extension("Submit", { key: "S", hint: "submit", menuGroup: "act" }),
        extension("Open ticket", {
          key: "T",
          hint: "open ticket",
          menuGroup: "open",
        }),
        extension("Mute", { key: "z", hint: "mute" }),
      ],
      onOpenExt: () => {},
    })

  it("reads Act, Open, Switch, Copy, Quiet, Close", () => {
    expect(layoutOf(all()).map(([, group]) => group)).toEqual([
      "act",
      "act",
      "open",
      "open",
      "open",
      "switch",
      "switch",
      "switch",
      "copy",
      "copy",
      "copy",
      "quiet",
      "quiet",
      "quiet",
      "close",
      "close",
    ])
  })

  it("pins every row's label in place", () => {
    expect(layoutOf(all()).map(([label]) => label)).toEqual([
      "Land",
      "Submit",
      "Open PR",
      "Open in browser",
      "Open ticket",
      "Switch here",
      "Switch in new tab",
      "Switch in new pane",
      "Copy URL",
      "Copy repo name",
      "Copy branch name",
      "Unsubscribe",
      "Remove me as reviewer",
      "Mute",
      "Close PR",
      "Close PR and delete branch",
    ])
  })

  it("labels an extension by its capitalised hint, or its title without one", () => {
    const labels = layoutOf(all()).map(([label]) => label)
    // hint "open ticket" -> "Open ticket", not the title.
    expect(labels).toContain("Open ticket")
    expect(labels).toContain("Mute")
  })

  it("lands an unmarked extension with the quiet verbs", () => {
    const rows = layoutOf(
      buildActions(pr, "kud", () => {}, undefined, undefined, undefined, undefined, undefined, undefined, {
        extensions: [extension("Snooze", { key: "Z", hint: "snooze" })],
        onOpenExt: () => {},
      }),
    )
    expect(rows).toContainEqual(["Snooze", "quiet"])
  })

  it("still ends on close when the host contributes nothing", () => {
    const labels = buildActions(pr, "kud", () => {}).map((a) => a.label)
    expect(labels.slice(-2)).toEqual(["Close PR", "Close PR and delete branch"])
  })

  it("confirms a close through Close #N and Cancel, and nothing else", () => {
    const close = all().find((a) => a.label === "Close PR")
    expect(close?.subActions?.map((a) => [a.label, a.group])).toEqual([
      ["Close #42", "confirm"],
      ["Cancel", "confirm"],
    ])
    const andDelete = all().find(
      (a) => a.label === "Close PR and delete branch",
    )
    expect(andDelete?.subActions?.map((a) => [a.label, a.group])).toEqual([
      ["Close #42 and delete fix/a-row", "confirm"],
      ["Cancel", "confirm"],
    ])
  })
})

describe("the draft toggle's offer window", () => {
  // Shares the base PR's shape, pointed at its own invented repo so the
  // author/health pair, not the fixture default, is what each case reads.
  const toggled = (author: string, health?: GHItem["health"]): GHItem => ({
    ...pr,
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/42",
    author,
    health,
  })

  it("offers the viewer's own draft a way back to review", () => {
    const rows = buildActions(toggled("octocat", "draft"), "octocat", () => {})
    const flip = rows.find((a) => a.label === "Mark ready for review")
    expect(flip?.group).toBe("act")
    expect(rows.map((a) => a.label)).not.toContain("Convert to draft")
  })

  it("offers the viewer's own open PR the way back to draft", () => {
    const rows = buildActions(toggled("octocat", "none"), "octocat", () => {})
    const flip = rows.find((a) => a.label === "Convert to draft")
    expect(flip?.group).toBe("act")
    expect(rows.map((a) => a.label)).not.toContain("Mark ready for review")
  })

  it("offers neither on somebody else's PR", () => {
    const rows = buildActions(toggled("alice", "draft"), "octocat", () => {})
      .map((a) => a.label)
    expect(rows).not.toContain("Mark ready for review")
    expect(rows).not.toContain("Convert to draft")
  })

  it("offers neither on the viewer's own settled PRs", () => {
    for (const health of ["merged", "closed"] as const) {
      const rows = buildActions(
        toggled("octocat", health),
        "octocat",
        () => {},
      ).map((a) => a.label)
      expect(rows).not.toContain("Mark ready for review")
      expect(rows).not.toContain("Convert to draft")
    }
  })
})

describe("the issue action menu's order", () => {
  it("pins every row's label in place", () => {
    const labels = buildActions(
      issue,
      "kud",
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      () => true,
    ).map((a) => a.label)
    // No review request to withdraw on an issue, no branch to switch or copy:
    // the Switch band opens checkouts, Quiet only unsubscribes.
    expect(labels).toEqual([
      "View issue",
      "Open in browser",
      "Open in new tab",
      "Open in new pane",
      "Copy URL",
      "Copy repo name",
      "Unsubscribe",
      "Close issue",
    ])
  })
})

describe("the ticket action menu's order", () => {
  it("puts the status move first, ahead of the opens", () => {
    const labels = buildActions(
      task,
      "kud",
      () => {},
      undefined,
      undefined,
      [{ label: "Done", transition: "Done" }],
    ).map((a) => a.label)
    expect(labels).toEqual([
      "Move status",
      "View ticket",
      "Open in browser",
      "Copy URL",
    ])
  })
})
