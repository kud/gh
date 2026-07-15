import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import { resolveCurrentPr, resolveCurrentRepo } from "./index.js"

vi.mock("execa", () => ({ execa: vi.fn() }))
const mockedExeca = vi.mocked(execa)

beforeEach(() => mockedExeca.mockReset())

describe("resolveCurrentPr", () => {
  it("derives owner/repo from the PR url", async () => {
    mockedExeca.mockResolvedValueOnce({
      stdout: JSON.stringify({
        number: 12,
        title: "Add thing",
        url: "https://github.com/kud/gh/pull/12",
        headRefName: "feat/thing",
        headRepository: { name: "gh" },
        headRepositoryOwner: { login: "kud" },
      }),
    } as never)

    const pr = await resolveCurrentPr()

    expect(pr).toEqual({
      number: 12,
      repo: "kud/gh",
      url: "https://github.com/kud/gh/pull/12",
      title: "Add thing",
      branch: "feat/thing",
    })
  })

  it("falls back to head repository fields when the url does not match", async () => {
    mockedExeca.mockResolvedValueOnce({
      stdout: JSON.stringify({
        number: 3,
        title: "Fork PR",
        url: "https://example.com/weird",
        headRefName: "fix/x",
        headRepository: { name: "gh" },
        headRepositoryOwner: { login: "contributor" },
      }),
    } as never)

    const pr = await resolveCurrentPr()

    expect(pr.repo).toBe("contributor/gh")
  })
})

describe("resolveCurrentRepo", () => {
  it("returns the trimmed nameWithOwner", async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: "kud/gh\n" } as never)
    expect(await resolveCurrentRepo()).toBe("kud/gh")
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "repo",
      "view",
      "--json",
      "nameWithOwner",
      "-q",
      ".nameWithOwner",
    ])
  })
})
