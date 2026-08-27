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
    expect(numbersIn(filterByOrigin(section(), "matched", isAcme))).toEqual([
      1, 3,
    ])
  })

  it("keeps everything else on the other side", () => {
    expect(numbersIn(filterByOrigin(section(), "rest", isAcme))).toEqual([2])
  })

  // Guard the guard: both assertions above pass just as well against an empty
  // result, which is what a predicate wired backwards would produce on one side.
  it("splits the rows rather than dropping them", () => {
    const matched = numbersIn(filterByOrigin(section(), "matched", isAcme))
    const rest = numbersIn(filterByOrigin(section(), "rest", isAcme))
    expect([...matched, ...rest].sort()).toEqual([1, 2, 3])
  })

  // A section that empties out is dropped, not left as a headed blank — which is
  // why the host must not be able to land on a side its scope has nothing on.
  it("drops a section with nothing left on this side", () => {
    const onlyAcme = [
      { id: "mine", label: "Mine", items: layoutGHItems([item("acme/api", 1)], "mine") },
    ]
    expect(filterByOrigin(onlyAcme, "rest", isAcme)).toEqual([])
  })
})
