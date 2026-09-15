import { execa } from "execa"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchDefaultBranch } from "./index.js"

vi.mock("execa", () => ({ execa: vi.fn() }))
const mockedExeca = vi.mocked(execa)

beforeEach(() => mockedExeca.mockReset())

describe("fetchDefaultBranch", () => {
  it("shells out to gh repo view for the default branch ref", async () => {
    mockedExeca.mockResolvedValueOnce({
      stdout: JSON.stringify({ defaultBranchRef: { name: "main" } }),
    } as never)

    expect(await fetchDefaultBranch("acme/api-gateway")).toBe("main")

    // Asserted by name, like the health projection: `gh pr view` carries no
    // default-branch field, so anyone folding this into that call to save a
    // round trip gets a projection that returns nothing. The name is the pin.
    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "repo",
      "view",
      "acme/api-gateway",
      "--json",
      "defaultBranchRef",
    ])
  })

  // An empty repository has no default branch, and a consumer suppressing
  // something on a match has to be able to tell "no match" from "do not know".
  it("reports undefined for a repo with no default branch", async () => {
    mockedExeca.mockResolvedValueOnce({
      stdout: JSON.stringify({ defaultBranchRef: null }),
    } as never)

    expect(await fetchDefaultBranch("acme/empty")).toBeUndefined()
  })

  /*
   * The failure direction is load-bearing, and the obvious kindness is the bug.
   *
   * Swallowing to `undefined` looks like the defensive choice — one cell of one
   * line should never break a drill-in. But `undefined` already MEANS something
   * here: draw the base anyway. Against cockpit's `useCachedResource`, which
   * revalidates on every mount, a swallowed failure would therefore redraw a
   * cell that had been correctly suppressed — one network blip, and `→ main`
   * flickers back onto a PR it had been absent from.
   *
   * Throwing lets the cache keep the good value it already holds. This spec is
   * what stops the swallow being reinstated as a tidy-up.
   */
  it("throws on a failed lookup, so a cache can keep its last good value", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("gh: not found"))

    await expect(fetchDefaultBranch("acme/gone")).rejects.toThrow("not found")
  })
})
