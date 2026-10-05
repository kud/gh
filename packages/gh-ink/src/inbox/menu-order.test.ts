import { describe, expect, it } from "vitest"
import { buildActions } from "./inbox.js"
import type { GHItem } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// Closing is the one verb in the menu that cannot be taken back, so it sits
// last — after anything a host contributes. Land and Submit used to follow
// "Close PR", which put the destructive pair between the reader and the verb
// they opened the menu for.

const pr: GHItem = {
  kind: "pr",
  number: 42,
  title: "a row",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/pull/42",
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  branch: "fix/a-row",
}

const extension = (id: string, key: string): InboxExtension =>
  ({
    id,
    title: id,
    key,
    hint: id,
    scope: "item",
    body: () => null,
  }) as unknown as InboxExtension

describe("the PR action menu's order", () => {
  it("puts host extensions before the close actions, and close last", () => {
    const labels = buildActions(
      pr,
      "kud",
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        extensions: [extension("Land", "L"), extension("Submit", "S")],
        onOpenExt: () => {},
      },
    ).map((a) => a.label)

    expect(labels.slice(-4)).toEqual([
      "Land",
      "Submit",
      "Close PR",
      "Close PR + Delete branch",
    ])
  })

  it("still ends on close when the host contributes nothing", () => {
    const labels = buildActions(pr, "kud", () => {}).map((a) => a.label)
    expect(labels.slice(-2)).toEqual(["Close PR", "Close PR + Delete branch"])
  })
})
