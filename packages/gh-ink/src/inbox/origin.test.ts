import { describe, expect, it } from "vitest"
import { filterByOrigin, layoutGHItems, type GHItem } from "./inbox.js"

// The split is POSITIONAL — "the ones that matched" and "the rest" — and the
// package never names the sides. It took the literal strings "work" and "home"
// until 2026-08-27, which put one reader's two lives into a published library
// and printed a word in the header no other host would recognise.

const item = (repo: string, number: number): GHItem => ({
  kind: "pr",
  number,
  title: `#${number}`,
  repo,
  url: `https://github.com/${repo}/pull/${number}`,
  health: "none",
  age: "1d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const section = () => [
  {
    id: "mine",
    label: "Mine",
    items: layoutGHItems(
      [item("acme/api", 1), item("me/tool", 2), item("acme/web", 3)],
      "mine",
      "viewer",
    ),
  },
]

const isAcme = (repo: string) => repo.startsWith("acme/")

const numbersIn = (sections: ReturnType<typeof section>) =>
  sections
    .flatMap((s) => s.items)
    .filter((i): i is GHItem => i.kind === "pr")
    .map((i) => i.number)
    .sort()

describe("filterByOrigin", () => {
  it("keeps the side the predicate matched", () => {
    expect(numbersIn(filterByOrigin(section(), "matched", isAcme, "viewer"))).toEqual([
      1, 3,
    ])
  })

  it("keeps everything else on the other side", () => {
    expect(numbersIn(filterByOrigin(section(), "rest", isAcme, "viewer"))).toEqual([2])
  })

  // Guard the guard: both assertions above pass just as well against an empty
  // result, which is what a predicate wired backwards would produce on one side.
  it("splits the rows rather than dropping them", () => {
    const matched = numbersIn(filterByOrigin(section(), "matched", isAcme, "viewer"))
    const rest = numbersIn(filterByOrigin(section(), "rest", isAcme, "viewer"))
    expect([...matched, ...rest].sort()).toEqual([1, 2, 3])
  })

  // The filter lays the kept rows out AGAIN, and the second layout is only as
  // good as what it is handed. ambre's host ran this without a login for weeks:
  // a PR somebody had replied to on your own repo entered under Your move and
  // came out under Their move, with the turn arrow beside it still pointing at
  // you. The parameter is required now; this pins that the re-layout reads the
  // row against the same viewer the first one did.
  it("keeps a row claimed by their last word in Your move through the split", () => {
    const claimed = { ...item("me/tool", 2), lastActor: "somebody" }
    const before = [
      { id: "mine", label: "Mine", items: layoutGHItems([claimed], "mine", "viewer") },
    ]
    const bandOf = (sections: ReturnType<typeof section>) =>
      sections
        .flatMap((s) => s.items)
        .flatMap((i) => (i.kind === "subgroup-header" ? [i.label] : []))
    expect(bandOf(before)).toEqual(["Your move (1)"])
    expect(bandOf(filterByOrigin(before, "rest", isAcme, "viewer"))).toEqual([
      "Your move (1)",
    ])
  })

  // A section that empties out is dropped, not left as a headed blank — which is
  // why the host must not be able to land on a side its scope has nothing on.
  it("drops a section with nothing left on this side", () => {
    const onlyAcme = [
      { id: "mine", label: "Mine", items: layoutGHItems([item("acme/api", 1)], "mine", "viewer") },
    ]
    expect(filterByOrigin(onlyAcme, "rest", isAcme, "viewer")).toEqual([])
  })
})
