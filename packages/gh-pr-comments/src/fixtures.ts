import type { PrComments } from "@kud/gh"

// Fixtures behind `--mock`, for the cli-shot contract: a screenshot or a web
// demo outlives the moment it was taken, so it must never show a real
// repository, a real reviewer or a real comment. Every name, path and URL below
// is invented. The two screens are the same review at two moments — still being
// argued over, then settled — because that difference, threads open against
// threads resolved, is what the panel exists to make legible.

export type Fixture = { repo: string; number: number; data: PrComments }

const REPO = "acme/api-gateway"
const url = (id: number) =>
  `https://github.com/${REPO}/pull/482#discussion_r${id}`

const conversation = [
  {
    author: "rowan-hale",
    body:
      "Moves rate limiting from the edge proxy into the gateway, so limits " +
      "follow the **API key** rather than the client IP.\n\n" +
      "- token bucket per key, refilled lazily on read\n" +
      "- `429` now carries `Retry-After`\n" +
      "- the old proxy rule stays until the next release",
    createdAt: "2026-11-18T09:12:00Z",
  },
  {
    author: "imogen-vale",
    body: "Read it through once — the shape is right. Two things inline.",
    createdAt: "2026-11-18T14:40:00Z",
  },
]

const bucketThread = (resolved: boolean) => ({
  id: "RT_kwDOAcme001",
  path: "src/limits/bucket.ts",
  line: 42,
  originalLine: 42,
  isResolved: resolved,
  isOutdated: false,
  comments: [
    {
      author: "imogen-vale",
      databaseId: 71001,
      url: url(71001),
      body:
        "If two requests read the bucket at the same instant, both see the " +
        "old count and both pass. Could the refill and the take be one " +
        "`MULTI` block?",
      createdAt: "2026-11-18T14:41:00Z",
    },
    ...(resolved
      ? [
          {
            author: "rowan-hale",
            databaseId: 71004,
            url: url(71004),
            body: "Done in `b3e91c2` — refill and take are one script now.",
            createdAt: "2026-11-19T10:02:00Z",
          },
        ]
      : []),
  ],
})

const headerThread = (resolved: boolean) => ({
  id: "RT_kwDOAcme002",
  path: "src/limits/respond.ts",
  line: 17,
  originalLine: 17,
  isResolved: resolved,
  isOutdated: false,
  comments: [
    {
      author: "imogen-vale",
      databaseId: 71002,
      url: url(71002),
      body: "`Retry-After` wants whole seconds — this sends milliseconds.",
      createdAt: "2026-11-18T14:44:00Z",
    },
    {
      author: "rowan-hale",
      databaseId: 71003,
      url: url(71003),
      body: "Good catch, rounding up so a client never retries early.",
      createdAt: "2026-11-18T16:20:00Z",
    },
  ],
})

const outdatedThread = {
  id: "RT_kwDOAcme003",
  path: "src/limits/config.ts",
  line: null,
  originalLine: 9,
  isResolved: false,
  isOutdated: true,
  comments: [
    {
      author: "tobias-lund",
      databaseId: 70988,
      url: url(70988),
      body: "nit: `burst` reads better than `ceiling` here.",
      createdAt: "2026-11-17T17:05:00Z",
    },
  ],
}

export const FIXTURES: Record<string, Fixture> = {
  review: {
    repo: REPO,
    number: 482,
    data: {
      headRef: "feat/per-key-rate-limits",
      conversation,
      threads: [bucketThread(false), headerThread(false), outdatedThread],
    },
  },
  resolved: {
    repo: REPO,
    number: 482,
    data: {
      headRef: "feat/per-key-rate-limits",
      conversation: [
        ...conversation,
        {
          author: "imogen-vale",
          body: "Both addressed, approving. Thanks for the careful split.",
          createdAt: "2026-11-19T11:30:00Z",
        },
      ],
      threads: [bucketThread(true), headerThread(true)],
    },
  },
}

export const SCREENS = Object.keys(FIXTURES)
