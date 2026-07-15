import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import { mergePr, reRequestReviewer, rerunFailedRun } from "./index.js"

vi.mock("execa", () => ({ execa: vi.fn() }))
const mockedExeca = vi.mocked(execa)

beforeEach(() => mockedExeca.mockReset())

describe("PR actions", () => {
  it("merges a PR", async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: "" } as never)
    await mergePr("kud/gh", 5)
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "pr",
      "merge",
      "5",
      "--repo",
      "kud/gh",
      "--merge",
    ])
  })

  it("re-runs the failed jobs of a run", async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: "" } as never)
    await rerunFailedRun("kud/gh", "987")
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "run",
      "rerun",
      "987",
      "--repo",
      "kud/gh",
      "--failed",
    ])
  })

  it("re-requests a reviewer", async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: "" } as never)
    await reRequestReviewer("kud/gh", 5, "octocat")
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "pr",
      "edit",
      "5",
      "--repo",
      "kud/gh",
      "--add-reviewer",
      "octocat",
    ])
  })
})
