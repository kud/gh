import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import {
  computeHealth,
  fetchHealth,
  isFailCheck,
  isInconclusiveCheck,
  isPassCheck,
  isPendingCheck,
  latestChecks,
  type PrCheck,
} from "./index.js"

vi.mock("execa", () => ({ execa: vi.fn() }))
const mockedExeca = vi.mocked(execa)

beforeEach(() => mockedExeca.mockReset())

const check = (c: Partial<PrCheck>): PrCheck => c

describe("check classifiers", () => {
  it("classifies failing checks by conclusion or state", () => {
    expect(isFailCheck(check({ conclusion: "FAILURE" }))).toBe(true)
    expect(isFailCheck(check({ conclusion: "TIMED_OUT" }))).toBe(true)
    expect(isFailCheck(check({ conclusion: "ACTION_REQUIRED" }))).toBe(true)
    expect(isFailCheck(check({ state: "ERROR" }))).toBe(true)
    expect(isFailCheck(check({ conclusion: "SUCCESS" }))).toBe(false)

    // A workflow file too broken to start is a verdict on the code, and it was
    // in no set at all — so it read as neither failing nor pending nor passing
    // and rendered quiet.
    expect(isFailCheck(check({ conclusion: "STARTUP_FAILURE" }))).toBe(true)
  })

  it("does not call a check that reached no verdict a failure", () => {
    // The line these pin is verdict vs no-verdict, not green vs not-green. A
    // run that was killed or abandoned examined nothing, so there is nothing
    // in it for an author to fix — and calling it red said there was.
    expect(isFailCheck(check({ conclusion: "CANCELLED" }))).toBe(false)
    expect(isFailCheck(check({ conclusion: "STALE" }))).toBe(false)

    expect(isInconclusiveCheck(check({ conclusion: "CANCELLED" }))).toBe(true)
    expect(isInconclusiveCheck(check({ conclusion: "STALE" }))).toBe(true)
    expect(isInconclusiveCheck(check({ conclusion: "FAILURE" }))).toBe(false)
    expect(isInconclusiveCheck(check({ conclusion: "SUCCESS" }))).toBe(false)

    // Not a failure is not the same as a pass: it must not count as green
    // either, or a cancelled run would report the PR as ready to merge.
    expect(isPassCheck(check({ conclusion: "CANCELLED" }))).toBe(false)
  })

  it("classifies pending checks", () => {
    expect(isPendingCheck(check({ status: "IN_PROGRESS" }))).toBe(true)
    expect(isPendingCheck(check({ state: "PENDING" }))).toBe(true)
    expect(isPendingCheck(check({ conclusion: "SUCCESS" }))).toBe(false)
  })

  it("classifies passing checks only on an explicit success signal", () => {
    expect(isPassCheck(check({ conclusion: "SUCCESS" }))).toBe(true)
    expect(isPassCheck(check({ conclusion: "NEUTRAL" }))).toBe(true)
    expect(isPassCheck(check({ state: "SUCCESS" }))).toBe(true)
    expect(isPassCheck(check({ status: "IN_PROGRESS" }))).toBe(false)
    expect(isPassCheck(check({ conclusion: "FAILURE" }))).toBe(false)
  })
})

describe("latestChecks", () => {
  it("keeps the highest databaseId per name and drops SKIPPED", () => {
    const checks: PrCheck[] = [
      { name: "build", conclusion: "FAILURE", databaseId: 1 },
      { name: "build", conclusion: "SUCCESS", databaseId: 2 },
      { name: "lint", conclusion: "SKIPPED", databaseId: 3 },
    ]
    const latest = latestChecks(checks)
    expect(latest).toEqual([
      { name: "build", conclusion: "SUCCESS", databaseId: 2 },
    ])
  })
})

describe("computeHealth precedence", () => {
  const pr = (over: Parameters<typeof computeHealth>[0]) =>
    computeHealth({ isDraft: false, checks: [], ...over })

  it("returns terminal states first", () => {
    expect(computeHealth({ state: "MERGED", checks: [] })).toBe("merged")
    expect(computeHealth({ state: "CLOSED", checks: [] })).toBe("closed")
  })

  it("returns none for a non-PR (no isDraft) and draft for a draft PR", () => {
    expect(computeHealth({ checks: [] })).toBe("none")
    expect(computeHealth({ isDraft: true, checks: [] })).toBe("draft")
  })

  it("ranks ci-fail above everything actionable", () => {
    expect(
      pr({
        checks: [{ name: "ci", conclusion: "FAILURE" }],
        mergeable: "CONFLICTING",
        reviewDecision: "CHANGES_REQUESTED",
        unresolvedThreads: 3,
      }),
    ).toBe("ci-fail")
  })

  it("ranks conflict, then changes-req, then threads", () => {
    expect(
      pr({ mergeable: "CONFLICTING", reviewDecision: "CHANGES_REQUESTED" }),
    ).toBe("conflict")
    expect(
      pr({ reviewDecision: "CHANGES_REQUESTED", unresolvedThreads: 2 }),
    ).toBe("changes-req")
    expect(pr({ unresolvedThreads: 2, reviewDecision: "APPROVED" })).toBe(
      "threads",
    )
  })

  it("falls through pending → approved → waiting", () => {
    expect(
      pr({
        checks: [{ name: "ci", status: "IN_PROGRESS" }],
        reviewDecision: "APPROVED",
      }),
    ).toBe("pending")
    expect(pr({ reviewDecision: "APPROVED" })).toBe("approved")
    expect(pr({})).toBe("waiting")
  })

  it("leaves a cancelled check without a token of its own", () => {
    // gnachman/iTerm2#731, 2026-08-28: python-api-tests SUCCESS, xcode-tests
    // CANCELLED after six hours waiting for a macOS runner nobody here owns.
    // It banded under "Your move" with a red glyph and the author could not
    // see why — because nothing was wrong. It reads as `waiting` now, which is
    // what a PR with no verdict and no review actually is. The other half of
    // this lives in @kud/gh-ink, where whoseMove sends `waiting` on your own
    // PR to Their move.
    expect(
      pr({
        checks: [
          { name: "python-api-tests", conclusion: "SUCCESS" },
          { name: "xcode-tests", conclusion: "CANCELLED" },
        ],
      }),
    ).toBe("waiting")

    // A real failure alongside it still wins: this loosens one token, not the
    // ladder.
    expect(
      pr({
        checks: [
          { name: "xcode-tests", conclusion: "CANCELLED" },
          { name: "lint", conclusion: "FAILURE" },
        ],
      }),
    ).toBe("ci-fail")
  })
})

describe("fetchHealth", () => {
  it("shells out to gh pr view with the health projection", async () => {
    const payload = {
      statusCheckRollup: [],
      reviews: [],
      reviewDecision: null,
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      author: { login: "kud" },
    }
    mockedExeca.mockResolvedValueOnce({
      stdout: JSON.stringify(payload),
    } as never)

    const data = await fetchHealth("kud/gh", 7)

    expect(data).toEqual(payload)
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "pr",
      "view",
      "7",
      "--repo",
      "kud/gh",
      "--json",
      "statusCheckRollup,reviews,reviewDecision,mergeable,mergeStateStatus,author",
    ])
  })
})
