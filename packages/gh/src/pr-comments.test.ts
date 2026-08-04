import { beforeEach, describe, expect, it, vi } from "vitest"
import { execa } from "execa"
import {
  fetchPrComments,
  replyToThread,
  resolveThread,
  unresolveThread,
} from "./index.js"

vi.mock("execa", () => ({
  execa: vi.fn(),
}))

const mockedExeca = vi.mocked(execa)

const stdoutOf = (data: unknown) =>
  ({ stdout: JSON.stringify({ data }) }) as never

beforeEach(() => {
  mockedExeca.mockReset()
})

describe("fetchPrComments", () => {
  it("maps conversation comments, review threads, and defaults the head ref", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({
        repository: {
          pullRequest: {
            headRefName: "feature/foo",
            comments: {
              nodes: [{ author: { login: "alice" }, body: "  looks good  " }],
            },
            reviewThreads: {
              nodes: [
                {
                  id: "thread-1",
                  path: "src/index.ts",
                  line: 10,
                  originalLine: 9,
                  isResolved: false,
                  isOutdated: false,
                  comments: {
                    nodes: [
                      {
                        databaseId: 123,
                        author: { login: "bob" },
                        body: "  fix this  ",
                        bodyText: "fix this",
                        url: "https://github.com/kud/gh/pull/1#discussion_r123",
                        path: "src/index.ts",
                        diffHunk: "@@ -1,3 +1,3 @@",
                        createdAt: "2026-01-01T00:00:00Z",
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      }),
    )

    const result = await fetchPrComments("kud", "gh", 1)

    expect(result.headRef).toBe("feature/foo")
    expect(result.conversation).toEqual([
      { author: "alice", body: "looks good" },
    ])
    expect(result.threads).toEqual([
      {
        id: "thread-1",
        path: "src/index.ts",
        line: 10,
        originalLine: 9,
        isResolved: false,
        isOutdated: false,
        comments: [
          {
            author: "bob",
            body: "fix this",
            databaseId: 123,
            url: "https://github.com/kud/gh/pull/1#discussion_r123",
            path: "src/index.ts",
            diffHunk: "@@ -1,3 +1,3 @@",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ])
  })

  it("leads the conversation with the description", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({
        repository: {
          pullRequest: {
            headRefName: "feature/foo",
            body: "  ## Summary\n\nWhy this change.  ",
            author: { login: "alice" },
            createdAt: "2026-01-01T00:00:00Z",
            comments: {
              nodes: [
                {
                  author: { login: "bob" },
                  body: "looks good",
                  createdAt: "2026-01-02T00:00:00Z",
                },
              ],
            },
            reviewThreads: { nodes: [] },
          },
        },
      }),
    )

    const result = await fetchPrComments("kud", "gh", 3)

    expect(result.conversation).toEqual([
      {
        author: "alice",
        body: "## Summary\n\nWhy this change.",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        author: "bob",
        body: "looks good",
        createdAt: "2026-01-02T00:00:00Z",
      },
    ])
  })

  // A description-less PR is the common case for a one-line fix, and a null
  // body is what GitHub actually returns for one — not an empty string.
  it("adds no description entry when the body is null or blank", async () => {
    for (const body of [null, "   "]) {
      mockedExeca.mockResolvedValueOnce(
        stdoutOf({
          repository: {
            pullRequest: {
              headRefName: "feature/foo",
              body,
              author: { login: "alice" },
              createdAt: "2026-01-01T00:00:00Z",
              comments: { nodes: [] },
              reviewThreads: { nodes: [] },
            },
          },
        }),
      )

      const result = await fetchPrComments("kud", "gh", 4)

      expect(result.conversation).toEqual([])
    }
  })

  it("falls back to ghost for comments with no author", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({
        repository: {
          pullRequest: {
            headRefName: null,
            comments: {
              nodes: [{ author: null, body: "deleted user comment" }],
            },
            reviewThreads: { nodes: [] },
          },
        },
      }),
    )

    const result = await fetchPrComments("kud", "gh", 2)

    expect(result.headRef).toBe("HEAD")
    expect(result.conversation).toEqual([
      { author: "ghost", body: "deleted user comment" },
    ])
    expect(result.threads).toEqual([])
  })

  it("throws when the pull request does not exist", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({ repository: { pullRequest: null } }),
    )

    await expect(fetchPrComments("kud", "gh", 999)).rejects.toThrow(
      "pull request not found: kud/gh#999",
    )
  })

  it("invokes gh api graphql with the query and variables", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({
        repository: {
          pullRequest: {
            headRefName: "main",
            comments: { nodes: [] },
            reviewThreads: { nodes: [] },
          },
        },
      }),
    )

    await fetchPrComments("kud", "gh", 42)

    expect(mockedExeca).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining([
        "api",
        "graphql",
        "-f",
        expect.stringContaining("query"),
        "-f",
        "owner=kud",
        "-f",
        "name=gh",
        "-F",
        "number=42",
      ]),
    )
  })
})

describe("replyToThread", () => {
  it("posts a reply comment via gh api", async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: "" } as never)

    await replyToThread({
      repo: "kud/gh",
      pull: 1,
      inReplyTo: 123,
      body: "thanks!",
    })

    expect(mockedExeca).toHaveBeenCalledWith("gh", [
      "api",
      "repos/kud/gh/pulls/1/comments",
      "-f",
      "body=thanks!",
      "-F",
      "in_reply_to=123",
    ])
  })
})

describe("resolveThread", () => {
  it("resolves a thread and returns the resulting isResolved state", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({ resolveReviewThread: { thread: { isResolved: true } } }),
    )

    const isResolved = await resolveThread("thread-1")

    expect(isResolved).toBe(true)
  })
})

describe("unresolveThread", () => {
  it("unresolves a thread and returns the resulting isResolved state", async () => {
    mockedExeca.mockResolvedValueOnce(
      stdoutOf({ unresolveReviewThread: { thread: { isResolved: false } } }),
    )

    const isResolved = await unresolveThread("thread-1")

    expect(isResolved).toBe(false)
  })
})
