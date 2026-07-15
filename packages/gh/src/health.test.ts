import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import {
  computeHealth,
  fetchHealth,
  isFailCheck,
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
