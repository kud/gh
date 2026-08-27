import { $ } from "zx"
import { spawn } from "child_process"
import { existsSync, readdirSync, statSync, watch } from "fs"
import { dirname, basename, join } from "path"
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from "react"
import { Text as InkText, Box, useInput, useWindowSize } from "ink"
import type { InboxExtension, ExtensionTarget } from "./extension.js"
import { invalidateCache, isFresh, readCache, writeCache } from "./cache.js"
import { checkoutDirs, inboxConfig, profileOf } from "./config.js"
import {
  diffSections,
  keyOf,
  summariseDiff,
  tabsOfMarks,
  transientOf,
} from "./diff.js"
import type { Transient } from "./diff.js"
import {
  FooterHints,
  LoadingScreen,
  StatusMessage,
  Tabs,
  Switch,
  useListCursor,
} from "@kud/ink-ui"
import {
  type Health,
  computeHealth as ghComputeHealth,
  latestChecks,
  isPassCheck,
  isFailCheck,
  isPendingCheck,
} from "@kud/gh"
import { healthDisplay, healthLegend } from "../lib/health-display.js"

// Every child process this module spawns goes through here, and none may inherit
// its output. A bare zx `$` captures a child's stdout but passes its STDERR
// straight to the terminal, and `gh`/`jira` print confirmations like "✓ Closed
// issue #N" there so stdout stays pipeable. Ink owns a region of stdout and
// repaints it; it has no view of stderr at all, so that line lands raw at the
// cursor OUTSIDE the frame and flickers there until the next render scrolls it
// away — a duplicate of a message the inbox was already showing properly through
// showFlash, which renders inside the border. Nothing in a full-screen TUI ever
// wants a child's raw output, `open`'s failure text included.
const quietly = $({ quiet: true })

// ─── Work filter ─────────────────────────────────────────────────────────────

export type GHDetail = {
  reviewDecision?: string
  mergeable?: string
  checksPass: number
  checksFail: number
  checksPending: number
  threadsTotal: number
  lastCommitAt?: string
  lastEventAt?: string
}

export type GHItem = {
  kind: "pr" | "issue"
  number: number
  title: string
  repo: string
  url: string
  branch?: string
  health: Health
  author?: string
  // Time since the item was opened — or, on the Done tab, since it was closed.
  age: string
  // Time since anything actually happened on it: a comment, a review, a thread
  // reply, a push. Left unset when it would merely repeat `age`, so an item
  // nobody has touched shows one value rather than the same one twice. What
  // counts as activity is the surface's question, not this layer's — cockpit
  // folds conversation and commits together, another host may not.
  activityAge?: string
  // The sort key, in whatever sense of recency the surface means: last activity
  // while an item is open, completion time once it is done.
  ts: number
  unresolved: number
  // Total comments across the conversation, review bodies and every thread —
  // the "is anything being discussed here" signal.
  conversation: number
  // Who spoke last, anywhere on the item. Compared against the viewer's login
  // at render time to decide whose turn it is.
  lastActor?: string
  detail?: GHDetail
  /**
   * Where YOU stand on this row, when the host knows it per row rather than per
   * tab. Set it and the whose-move band reads it instead of inferring from the
   * section id — which is what lets one tab hold rows of mixed standing: a
   * review asked of you and one you have already given differ only in whether
   * the ball comes back, and that is a fact about the search a row came from,
   * never about the PR. Left unset, the section id decides as before.
   */
  standing?: Standing
  indent: boolean
}

export type TaskRow = {
  kind: "task"
  key: string
  summary: string
  url: string
  status: string
  age: string
  indent: boolean
  instanceKey?: string
  /**
   * Trailing annotation, rendered dim after the summary — a recurrence marker,
   * a source hint, anything secondary to the title. Its own node rather than
   * part of `summary` so it can be dimmed, and so its width is measured
   * separately instead of being smuggled past the truncation maths.
   */
  note?: string
  /**
   * The Jira issue key behind this row, when one exists. Its PRESENCE is what
   * turns on the ticket affordances — ↵ opens a menu led by `jira issue view`,
   * and `t` transitions the issue. A row without it is just a task: ↵ opens its
   * URL and nothing here shells out to `jira`.
   *
   * Separate from `key` because the two are not the same thing. `key` is the
   * left column, and a caller is free to put anything legible there: cockpit
   * puts the ticket key, `life` puts a Todoist project name. Reading the drill
   * off `key` is what made `life` run `jira issue view "Maison       "` and
   * label it "View ticket" on a surface that has never touched Jira.
   */
  ticket?: string
}

export type RepoHeader = {
  kind: "repo-header"
  repo: string
  age: string
  indent: boolean
}

export type ShowMore = {
  kind: "show-more"
  hidden: GHItem[]
  indent: boolean
}

export type ShowLess = {
  kind: "show-less"
  toHide: GHItem[]
  indent: boolean
}

export type SubgroupHeader = {
  kind: "subgroup-header"
  label: string
  age: string
  indent: boolean
}

export type AnyItem =
  GHItem | TaskRow | RepoHeader | SubgroupHeader | ShowMore | ShowLess

// Standing status line for the "main pipeline we care about" — not a
// browsable list item, just a glance shown above the tabs. Drilling in
// shells out to the jenkins CLI's own interactive explorer rather than
// re-implementing a build/console viewer here.
export type CiStatus = {
  job: string
  buildNumber: number
  result: string
  building: boolean
  url: string
  age: string
}

export type Section = {
  id: string
  label: string
  items: AnyItem[]
}

// Everything a host needs to render a drilled-into row. `kind` is narrowed so a
// host can branch without re-testing item.kind.
export type DetailContext = {
  item: GHItem
  kind: "pr" | "issue"
  login: string
  onBack: () => void
  onRefresh: () => void
  onRemove: (item: GHItem) => void
  /**
   * The PR just merged from here. Returns to the list, marks the row merged for
   * a few seconds, then drops it — distinct from onRemove, which drops it at
   * once. Optional so a host that cannot merge need not implement it.
   */
  onMerged?: (item: GHItem) => void
}

export type Action = {
  label: string
  hint: string
  run: () => void
  subActions?: Action[]
}

export type JiraTransition = {
  /** What the action menu shows. Yours to word; nothing matches on it. */
  label: string
  /**
   * The TRANSITION name, passed verbatim to `jira issue move`. Not the
   * destination status, and the two are routinely different strings — jira-cli
   * matches `t.name.toLowerCase() === wanted`, so a status name here matches no
   * transition, the move silently does nothing, and the row simply does not
   * budge. This field was called `state`, which is what invited exactly that:
   * cockpit had `{ label: "UAT", state: "UAT" }` against an ACC workflow whose
   * transition is named "Ready for QA" and whose status is "In Testing (QA)" —
   * no "UAT" anywhere, and no error either.
   */
  transition: string
  /** Offered as a second step when the transition asks for a resolution. */
  resolutions?: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const relativeTime = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return `${Math.floor(diff / 604800)}w`
}

// The glance health derivation now lives in @kud/gh (shared with the health
// panel and the standalone CLIs). Cockpit's aggregation query shapes checks under
// statusCheckRollup.contexts.nodes and threads under reviewThreads.nodes, so we
// map the node into the core's transport-agnostic input. Behaviour is identical
// to the previous inline derivation — the precedence and check-dedup logic now
// lives once, in the core.
export type ExplainSection = { heading: string; lines: string[] }

const healthSentence = (item: GHItem): string => {
  const glyph = healthDisplay[item.health].glyph.trim()
  const d = item.detail
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`
  switch (item.health) {
    case "merged":
      return `Merged (${glyph}). Nothing left to do.`
    case "closed":
      return `Closed (${glyph}) without merging.`
    case "draft":
      return `Still a draft (${glyph}), so no review is being asked for yet.`
    case "ci-fail":
      return `CI is failing (${glyph}) — ${plural(
        d?.checksFail ?? 0,
        "check",
      )} red.`
    case "conflict":
      return `It conflicts with the base branch (${glyph}) and cannot merge until that is resolved.`
    case "changes-req":
      return `Changes were requested (${glyph}).`
    case "threads":
      return `${plural(
        item.unresolved,
        "review thread",
      )} still open (${glyph}).`
    case "pending":
      return `${plural(
        d?.checksPending ?? 0,
        "check",
      )} still running (${glyph}).`
    case "approved":
      return `Approved (${glyph}) and ready to merge.`
    case "waiting":
      return `Nobody has reviewed it yet (${glyph}).`
    default:
      return "An open issue — no review state applies."
  }
}

const checksSentence = (d?: GHDetail): string | null => {
  if (!d) return null
  const total = d.checksPass + d.checksFail + d.checksPending
  if (total === 0) return "No CI checks run on it."
  const parts: string[] = []
  if (d.checksPass) parts.push(`${d.checksPass} passing`)
  if (d.checksFail) parts.push(`${d.checksFail} failing`)
  if (d.checksPending) parts.push(`${d.checksPending} running`)
  return `Checks: ${parts.join(", ")}.`
}

// The stall test compares the last thing SAID with the last thing PUSHED. A PR
// sent back weeks ago whose author never pushed is not waiting on you, however
// urgent its glyph looks — that distinction is the whole reason this modal
// exists, so it gets its own sentence rather than being left to inference.
const turnSentences = (item: GHItem, login: string): string[] => {
  if (!item.lastActor) return ["Nothing has been said on it yet."]
  const d = item.detail
  const when = d?.lastEventAt ? `${relativeTime(d.lastEventAt)} ago` : "earlier"
  if (item.lastActor !== login)
    return [`${item.lastActor} spoke last (←), ${when}. Your reply is owed.`]

  // On your own PR there is no "them" to be stalled on — it is waiting on a
  // reviewer, and the push test below would otherwise read your own last commit
  // back to you as someone else's inaction.
  const them = item.author && item.author !== login ? item.author : null
  if (!them)
    return [
      `You spoke last (→), ${when}. It is waiting on a reviewer, not on you.`,
    ]

  const lines = [`You spoke last (→), ${when}. The ball is with ${them}.`]
  if (d?.lastCommitAt && d.lastEventAt && d.lastCommitAt < d.lastEventAt)
    lines.push(
      `Nothing has been pushed since ${relativeTime(
        d.lastCommitAt,
      )} ago, so it is stalled on ${them}, not on you.`,
    )
  return lines
}

export const explainItem = (item: GHItem, login: string): ExplainSection[] => {
  const author = item.author && item.author !== login ? item.author : "you"
  const kind = item.kind === "pr" ? "pull request" : "issue"
  const stands = [healthSentence(item)]
  const checks = item.kind === "pr" ? checksSentence(item.detail) : null
  if (checks) stands.push(checks)
  if (item.conversation > 0)
    stands.push(
      `${item.conversation} comment${
        item.conversation === 1 ? "" : "s"
      } across the conversation and its threads.`,
    )

  return [
    {
      heading: "What it is",
      lines: [
        `A ${kind} on ${item.repo}, opened by ${author} ${item.age} ago.`,
      ],
    },
    { heading: "Where it stands", lines: stands },
    { heading: "Whose turn", lines: turnSentences(item, login) },
  ]
}

// Rank from the host's ordered list rather than a compiled-in one. An entry
// ending in `/` matches an owner; anything else must equal `owner/name`, so a
// single repo can be pinned above the owner containing it. Unmatched repos share
// the last rank, which leaves the name tiebreak in sortItems to order them.
export const repoPriority = (repo: string): number => {
  const order = inboxConfig().repoPriority
  const i = order.findIndex((p) =>
    p.endsWith("/") ? repo.startsWith(p) : repo === p,
  )
  return i === -1 ? order.length : i
}

// Repo grouping is the OUTER key and is deliberately unchanged — priority tier,
// then repo name — because insertRepoHeaders below depends on same-repo items
// staying adjacent, and a strict recency sort scatters a repo down the list.
// Within a repo, two keys break the tie: draft-ness, then recency — the one
// place either can reorder rows without costing the grouping.
//
// Draft sinks because a draft is not asking. Every tab but `draft` itself is a
// RELATIONSHIP ("they requested you", "it's on your repo"), and a draft row
// answers the only question those tabs pose with "not yet" — including the case
// that reads worst, a PR that had you requested and was then converted BACK to
// draft. Recency alone floated exactly that row to the top of the list, since a
// fresh draft outranks an open PR someone has genuinely been waiting on for a
// fortnight. Sunk, not filtered: a draft you were deliberately asked to look at
// early must still be visible, and it keeps its `~` glyph either way.
//
// Sorting on `ts` and not on `age`: `age` is a rendered string ("23h", "2d") and
// sorts lexicographically, which puts "2d" before "23h".
export const sortItems = (items: GHItem[]): GHItem[] =>
  [...items].sort((a, b) => {
    const pd = repoPriority(a.repo) - repoPriority(b.repo)
    if (pd !== 0) return pd
    const rd = a.repo.localeCompare(b.repo)
    if (rd !== 0) return rd
    const dd = Number(a.health === "draft") - Number(b.health === "draft")
    return dd !== 0 ? dd : b.ts - a.ts
  })

// Flat, newest-first ordering. Repos are *not* clustered — an item's repo
// header still appears (via insertRepoHeaders), but only when the repo changes
// as we walk down the timeline, so the same repo can recur further down.
export const sortByRecency = (items: GHItem[]): GHItem[] =>
  [...items].sort((a, b) => b.ts - a.ts)

export const insertRepoHeaders = (items: GHItem[]): AnyItem[] => {
  const result: AnyItem[] = []
  let lastRepo = ""
  for (const item of items) {
    if (!item.indent && item.repo !== lastRepo) {
      lastRepo = item.repo
      result.push({
        kind: "repo-header",
        repo: item.repo,
        age: "",
        indent: false,
      })
    }
    result.push(item)
  }
  return result
}

// Where you stand relative to a row. `health` is a fact about the PR; the same
// token means opposite things depending on which side of it you are on, and the
// side is not on the PR — it is a property of the SEARCH the row arrived from.
// Three positions, not two:
//
//   authored  you own the branch — its problems are your afternoon
//   queued    someone else owns it and a review is still wanted from YOU
//   spoken    someone else owns it and you have already given your review
//
// `spoken` is not a shade of `queued`, which is the mistake this started as.
// The `reviewed` search is `reviewed-by:@me -author:@me -review-requested:@me`:
// that last exclusion means GitHub is provably not waiting on you, and a PR you
// reviewed that gets re-requested leaves that search for `review-requested:@me`.
// Banding it like a queue put "awaiting review" and "approved" under Your move
// where both are certainly somebody else's.
export type Standing = "authored" | "queued" | "spoken"

// The per-TAB fallback, for a host whose every row in a tab shares a standing.
// A host that merges two searches into one tab sets `standing` on the rows
// instead, and this is never consulted for them.
const STANDING: Record<string, Standing> = {
  mine: "authored",
  // `open` and `draft` predate `mine` and are the same standing: a host that
  // still splits its own PRs by draft-ness keeps working, and one that folds
  // them into a single tab (as cockpit does — the band already sinks a draft,
  // so the split said it twice) gets the same reading.
  open: "authored",
  draft: "authored",
  assigned: "authored",
  issues: "authored",
  review: "queued",
  incoming: "queued",
  reviewed: "spoken",
}

// What is YOURS from each position. Read down a column and the flips are the
// point: the mechanical blockers (ci-fail, conflict, changes-req) are yours only
// on your own PR, and the queue states (waiting, pending) only while a review is
// still wanted from you. `threads` alone is yours from all three — it is
// literally "your reply is owed", and it is the only thing left on a PR you have
// already reviewed.
//
// `draft` is yours ONLY when you authored it, and that asymmetry is the whole
// point of listing it here. The band asks whose move it is, and on your own
// draft there is no one else in the room — nobody can advance it, nobody has
// been asked to, and filing it under Their move said the opposite of what was
// true. Somebody else's draft you were pointed at stays theirs, which is why
// this appears in `authored` and not in the other two.
//
// It is still SUNK to the bottom of its band by sortItems: yours to finish is
// not the same as yours to finish now, and a fresh draft must not outrank a PR
// somebody has genuinely been waiting on. Visible as yours, ranked last.
//
// `none` remains unlisted from every position — an issue has no review state to
// read, so claiming it would be a guess rather than a reading.
const YOURS: Record<Standing, Health[]> = {
  authored: ["ci-fail", "conflict", "changes-req", "threads", "approved", "draft"],
  queued: ["waiting", "pending", "threads", "approved"],
  spoken: ["threads"],
}

// The row's own standing wins where the host set one; the tab decides otherwise,
// and an unrecognised tab reads as `queued` — over-claiming a stranger's PR as
// your work is the worse wrong guess.
export const whoseMove = (
  health: Health,
  sectionId: string,
  standing?: Standing,
): "you" | "them" =>
  YOURS[standing ?? STANDING[sectionId] ?? "queued"].includes(health)
    ? "you"
    : "them"

const BAND_LABEL: Record<"you" | "them", string> = {
  you: "Your move",
  them: "Their move",
}

// Lay out a section's GH items. The Done tab is a flat newest-first list; every
// other tab splits into two whose-move bands, each keeping its own repo grouping
// so the outer key stays legible inside a band. Repo headers are inserted in
// every case, and restart per band — a repo with work on both sides of the line
// appears under each.
//
// One band is not a band: a tab whose rows all land on the same side gains two
// header rows and no information, so it keeps the plain list. That is not an
// edge case, it is the Draft and Issues tabs by construction — every row there
// carries the same health token, so the split has nothing to say.
export const layoutGHItems = (
  items: GHItem[],
  sectionId: string,
): AnyItem[] => {
  if (sectionId === "done") return insertRepoHeaders(sortByRecency(items))

  const sorted = sortItems(items)
  const bands = (["you", "them"] as const).map((side) => ({
    side,
    rows: sorted.filter(
      (i) => whoseMove(i.health, sectionId, i.standing) === side,
    ),
  }))
  const filled = bands.filter((b) => b.rows.length > 0)
  if (filled.length < 2) return insertRepoHeaders(sorted)

  return filled.flatMap(({ side, rows }) => [
    {
      kind: "subgroup-header" as const,
      label: `${BAND_LABEL[side]} (${rows.length})`,
      age: "",
      indent: false,
    },
    ...insertRepoHeaders(rows),
  ])
}

/**
 * A two-way repo split, when a host has one. `undefined` — the ordinary case —
 * means no split at all: every row stands.
 *
 * The package deliberately does not NAME the sides. It hardcoded "work" and
 * "home" until 2026-08-27: one reader's two lives compiled into a library
 * anyone can install, printed in a header where no other host would recognise
 * the word. The predicate, the side, and the word are all yours.
 *
 * Chosen once, by the host, before the first paint. There is no in-app toggle,
 * because a key that flipped it could only ever put the inbox out of step with
 * the scope the command was started in, with nothing on screen to explain the
 * disagreement.
 */
export type OriginSplit = {
  /** Rows whose repo this matches are one side; everything else is the other. */
  match: (repo: string) => boolean
  /** Which side to show. */
  show: "matched" | "rest"
  /** What to call the visible side in the header. Omitted, nothing is shown. */
  label?: string
}

/**
 * Keep only one side of a two-way repo split, leaving non-GH rows (task)
 * untouched. Mirrors filterByRepos' gh/other split.
 *
 * `keep` is positional — "the ones that matched" or "the rest" — and never a
 * name. This took the literal strings "work" and "home" until 2026-08-27, which
 * is one reader's life compiled into a published library: no other host has
 * those two categories, and several have none at all.
 */
export const filterByOrigin = (
  sections: Section[],
  keep: "matched" | "rest",
  match: (repo: string) => boolean,
): Section[] =>
  sections
    .map((s) => {
      const kept = s.items.filter(
        (i) =>
          i.kind !== "repo-header" &&
          i.kind !== "subgroup-header" &&
          i.kind !== "show-more" &&
          i.kind !== "show-less" &&
          (i.kind === "pr" || i.kind === "issue"
            ? keep === "matched"
              ? match(i.repo)
              : !match(i.repo)
            : true),
      )
      const gh = kept.filter(
        (i): i is GHItem => i.kind === "pr" || i.kind === "issue",
      )
      const other = kept.filter((i) => i.kind !== "pr" && i.kind !== "issue")
      return { ...s, items: [...layoutGHItems(gh, s.id), ...other] }
    })
    .filter((s) =>
      s.items.some(
        (i) => i.kind !== "repo-header" && i.kind !== "subgroup-header",
      ),
    )

const searchText = (i: AnyItem): string =>
  i.kind === "pr" || i.kind === "issue"
    ? `${i.title} ${i.repo} #${i.number}`
    : i.kind === "task"
      ? `${i.summary} ${i.key}`
      : ""

export const filterBySearch = (
  sections: Section[],
  query: string,
): Section[] => {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  return sections
    .map((s) => {
      const kept = s.items.filter(
        (i) =>
          i.kind !== "repo-header" &&
          i.kind !== "subgroup-header" &&
          i.kind !== "show-more" &&
          i.kind !== "show-less" &&
          searchText(i).toLowerCase().includes(q),
      )
      const gh = kept.filter(
        (i): i is GHItem => i.kind === "pr" || i.kind === "issue",
      )
      const other = kept.filter((i) => i.kind !== "pr" && i.kind !== "issue")
      return { ...s, items: [...layoutGHItems(gh, s.id), ...other] }
    })
    .filter((s) =>
      s.items.some(
        (i) => i.kind !== "repo-header" && i.kind !== "subgroup-header",
      ),
    )
}

export const filterByRepos = (
  sections: Section[],
  repos: Set<string>,
): Section[] => {
  if (repos.size === 0) return sections
  return sections
    .map((s) => {
      const kept = s.items.filter(
        (i) =>
          i.kind !== "repo-header" &&
          i.kind !== "subgroup-header" &&
          i.kind !== "show-more" &&
          i.kind !== "show-less" &&
          (i.kind === "pr" || i.kind === "issue" ? repos.has(i.repo) : true),
      )
      const gh = kept.filter(
        (i): i is GHItem => i.kind === "pr" || i.kind === "issue",
      )
      const other = kept.filter((i) => i.kind !== "pr" && i.kind !== "issue")
      return { ...s, items: [...layoutGHItems(gh, s.id), ...other] }
    })
    .filter((s) =>
      s.items.some(
        (i) => i.kind !== "repo-header" && i.kind !== "subgroup-header",
      ),
    )
}

// Drop one row and any header it orphans. Shared by the inbox and the app-level
// state so a close removes the row from whichever screen you closed it on —
// closing from the drill used to hand back to a list still showing the item
// until a refetch landed.
const isHeader = (i: AnyItem) =>
  i.kind === "repo-header" || i.kind === "subgroup-header"

// A header survives only while it still owns content, which is a question about
// the run that FOLLOWS it — not about the list as a whole. "Is there any
// non-header later on" kept every emptied repo whose header happened to be
// followed by another repo's rows, so only a trailing orphan ever disappeared.
//
// insertRepoHeaders emits a repo-header immediately before its own rows, so for
// one the test is just whether the next element is a row. A subgroup-header sits
// a level up, above repo-headers, so it scans past those and gives up only at
// the next subgroup or the end of the list.
const headerOwnsContent = (items: AnyItem[], idx: number): boolean => {
  const kind = items[idx].kind
  for (let i = idx + 1; i < items.length; i++) {
    const next = items[i]
    if (!isHeader(next)) return true
    if (kind === "repo-header" || next.kind === "subgroup-header") return false
  }
  return false
}

export const withoutItem = (sections: Section[], target: GHItem): Section[] =>
  sections
    .map((s) => {
      const kept = s.items.filter(
        (i) =>
          isHeader(i) ||
          !(
            i.kind === target.kind &&
            (i as GHItem).number === target.number &&
            (i as GHItem).repo === target.repo
          ),
      )
      return {
        ...s,
        items: kept.filter(
          (item, idx) => !isHeader(item) || headerOwnsContent(kept, idx),
        ),
      }
    })
    .filter((s) => s.items.some((i) => !isHeader(i)))

export const reposInSections = (sections: Section[]): string[] =>
  [
    ...new Set(
      sections
        .flatMap((s) => s.items)
        .filter((i): i is GHItem => i.kind === "pr" || i.kind === "issue")
        .map((i) => i.repo),
    ),
  ].sort()

export const moveCursor = (
  items: AnyItem[],
  current: number,
  dir: 1 | -1,
): number => {
  let next = current + dir
  while (
    next >= 0 &&
    next < items.length &&
    (items[next].kind === "repo-header" ||
      items[next].kind === "subgroup-header")
  )
    next += dir
  if (next < 0 || next >= items.length) return current
  return next
}

const itemLines = (item: AnyItem, isFirst: boolean): number =>
  (item.kind === "repo-header" || item.kind === "subgroup-header") && !isFirst
    ? 2
    : 1

export const fitCount = (
  items: AnyItem[],
  start: number,
  budget: number,
): number => {
  let lines = 0
  let count = 0
  for (let i = start; i < items.length; i++) {
    const cost = itemLines(items[i], i === start)
    if (lines + cost > budget) break
    lines += cost
    count++
  }
  return count
}

export const windowCount = (
  items: AnyItem[],
  start: number,
  budget: number,
): number => {
  const raw = fitCount(items, start, budget)
  // Reserve a single line for the "↓ N more" indicator when there's more below.
  // (Was 3 — the larger reservation released all at once at the end, so the
  // viewport grew by ~3 rows in one step and the list appeared to jump.)
  return start + raw < items.length ? fitCount(items, start, budget - 1) : raw
}

export const maxViewStart = (items: AnyItem[], budget: number): number => {
  let start = 0
  while (
    start < items.length - 1 &&
    start + windowCount(items, start, budget) < items.length
  )
    start++
  return start
}

// Where a section's cursor starts: the first row that is not a header. findIndex
// returns -1 for a section of headers alone, which Math.max floors to 0.
const firstSelectable = (section: Section): number =>
  Math.max(
    0,
    section.items.findIndex(
      (i) => i.kind !== "repo-header" && i.kind !== "subgroup-header",
    ),
  )

export const withHeaders = (items: AnyItem[], idx: number): number => {
  let start = idx
  while (
    start > 0 &&
    (items[start - 1].kind === "repo-header" ||
      items[start - 1].kind === "subgroup-header")
  )
    start--
  return start
}

export const truncate = (str: string, max: number): string => {
  if (str.length <= max) return str
  const half = Math.floor((max - 1) / 2)
  return `${str.slice(0, half)}…${str.slice(-half)}`
}

export const clipboard = (text: string) => {
  const p = spawn("pbcopy", [], { stdio: "pipe" })
  p.stdin.write(text)
  p.stdin.end()
}

// ─── iTerm2 helpers ───────────────────────────────────────────────────────────

export const buildCheckoutCmd = async (
  repoFull: string,
  branch: string,
  login: string,
): Promise<string> => {
  const [repoOwner, repoName] = repoFull.split("/")
  // Where a clone lands is the host's call: the profile claiming this repo, if it
  // keeps its own directory, else the configured fallback. Nothing is inferred
  // from the repo's owner.
  const searchDirs = checkoutDirs()
  const cloneBase =
    profileOf(repoFull)?.checkoutDir ?? inboxConfig().checkoutDir ?? ""

  let repoPath = ""
  outer: for (const searchDir of searchDirs) {
    if (!existsSync(searchDir)) continue
    let entries: string[]
    try {
      entries = readdirSync(searchDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = join(searchDir, entry)
      try {
        if (!statSync(fullPath).isDirectory()) continue
      } catch {
        continue
      }
      for (const remote of ["origin", "upstream"]) {
        const r = await $({
          nothrow: true,
          quiet: true,
        })`git -C ${fullPath} remote get-url ${remote}`
        if (r.exitCode === 0 && r.stdout.includes(repoFull)) {
          repoPath = fullPath
          break outer
        }
      }
    }
  }

  if (!repoPath) {
    const candidate = `${cloneBase}/${repoOwner}-${repoName}`
    if (existsSync(candidate)) repoPath = candidate
  }

  let cmd: string
  if (repoPath) {
    cmd = `cd ${repoPath}`
  } else if (repoOwner === login) {
    cmd = `cd ${cloneBase} && gh repo clone ${repoFull} && cd ${repoName}`
  } else {
    const r = await $({
      nothrow: true,
      quiet: true,
    })`gh repo list ${login} --fork --limit 200 --json name,parent --jq ${`.[] | select(.parent.nameWithOwner == "${repoFull}") | .name`}`
    const forkName = r.stdout.trim()
    if (forkName) {
      cmd = `cd ${cloneBase} && git clone git@github.com:${login}/${forkName}.git && cd ${forkName} && git remote add upstream git@github.com:${repoFull}.git`
    } else {
      cmd = `cd ${cloneBase} && gh repo fork ${repoFull} --clone && cd $(ls -td -- */ | head -1)`
    }
  }
  if (branch)
    cmd += ` && git fetch origin ${branch} 2>/dev/null; git switch ${branch}`
  return cmd
}

// Find a repo's local checkout by matching its git remote against ~/Projects
// (and the work/home split) — the "glob the github remote" resolution. Returns
// the absolute path, or null when the repo isn't checked out locally.
export const resolveRepoPath = async (
  repoFull: string,
): Promise<string | null> => {
  const searchDirs = checkoutDirs()
  for (const searchDir of searchDirs) {
    if (!existsSync(searchDir)) continue
    let entries: string[]
    try {
      entries = readdirSync(searchDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = join(searchDir, entry)
      try {
        if (!statSync(fullPath).isDirectory()) continue
      } catch {
        continue
      }
      for (const remote of ["origin", "upstream"]) {
        const r = await $({
          nothrow: true,
          quiet: true,
        })`git -C ${fullPath} remote get-url ${remote}`
        if (r.exitCode === 0 && r.stdout.includes(repoFull)) return fullPath
      }
    }
  }
  return null
}

export const itermRun = async (
  cmd: string,
  appleScript: string,
): Promise<void> => {
  await $({
    nothrow: true,
    quiet: true,
    env: { ...process.env, ITERM_CMD: cmd },
  })`osascript -e ${appleScript}`
}

export const jumpToRepo = async (
  repoFull: string,
  branch: string,
  login: string,
): Promise<void> => {
  const cmd = await buildCheckoutCmd(repoFull, branch, login)
  await itermRun(
    cmd,
    `tell application "iTerm2"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text (system attribute "ITERM_CMD")
        end tell
      end tell
    end tell`,
  )
}

export const runInPane = async (cmd: string): Promise<void> => {
  await itermRun(
    cmd,
    `tell application "iTerm2"
      tell current window
        tell current session of current tab
          set newPane to (split vertically with default profile)
          tell newPane
            write text (system attribute "ITERM_CMD")
          end tell
        end tell
      end tell
    end tell`,
  )
}

export const jumpToRepoPane = async (
  repoFull: string,
  branch: string,
  login: string,
): Promise<void> => {
  const cmd = await buildCheckoutCmd(repoFull, branch, login)
  await runInPane(cmd)
}

export const openInTab = async (cmd: string): Promise<void> => {
  await itermRun(
    cmd,
    `tell application "iTerm2"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text (system attribute "ITERM_CMD")
        end tell
      end tell
    end tell`,
  )
}

export const runInPaneHorizontal = async (cmd: string): Promise<void> => {
  await itermRun(
    cmd,
    `tell application "iTerm2"
      tell current window
        tell current session of current tab
          set newPane to (split horizontally with default profile)
          tell newPane
            write text (system attribute "ITERM_CMD")
          end tell
        end tell
      end tell
    end tell`,
  )
}

// Run in the *current* session: the command is typed after a short delay, so
// the caller must process.exit() immediately to free the terminal from the TUI
// before the text lands (mirrors the inbox's "switch here" action).
export const runHere = (cmd: string): void => {
  const proc = spawn(
    "osascript",
    [
      "-e",
      `delay 0.5
tell application "iTerm2"
  tell current session of current window
    write text (system attribute "ITERM_CMD")
  end tell
end tell`,
    ],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ITERM_CMD: cmd },
    },
  )
  proc.unref()
}

// ─── Data shared ──────────────────────────────────────────────────────────────

const FRAME_COLOR = "gray"
const FRAME_PAD_X = 1
const FRAME_CHROME_COLS = 2 /* border */ + FRAME_PAD_X * 2 /* padding */
export const COLS = (process.stdout.columns ?? 120) - FRAME_CHROME_COLS
const MODAL_CHROME_COLS = 2 /* border */ + 1 * 2 /* paddingX */

// An overlay floats over the list rather than replacing it, which only works
// because a Box with a background paints every cell it covers — without one Ink
// leaves the interior transparent and the rows behind bleed straight through the
// panel. A shade lighter than a dark terminal on purpose, so it reads as raised
// against the dimmed backdrop rather than as a hole cut in it.
const OVERLAY_BG = "#22222e"

// Ink has no cascade — every Text carries its own colour — so a subtree cannot be
// dimmed from above. The flag travels by context and the wrapper below applies
// it, which is why this module imports Ink's Text as `InkText` and shadows the
// name: every existing `<Text>` in the file became backdrop-aware without a
// single call site changing.
const DimContext = createContext(false)

type TextProps = React.ComponentProps<typeof InkText>

const Text = ({ children, ...props }: TextProps) => {
  const dimmed = useContext(DimContext)
  return dimmed ? (
    <InkText {...props} bold={false} dimColor>
      {children}
    </InkText>
  ) : (
    <InkText {...props}>{children}</InkText>
  )
}

// The list, dimmed and lifted out of the flow so an overlay can be laid over it.
// Ink paints in document order, so the backdrop has to come FIRST and the panel
// second — the reverse (panel absolute, over a list in flow) reads more naturally
// and is wrong twice: it paints under, and a panel taller than `height` is
// centre-clipped, losing its border and its last line. In flow the panel simply
// grows the row instead.
const Backdrop = ({
  dimmed,
  absolute,
  height,
  children,
}: {
  dimmed: boolean
  absolute: boolean
  height: number
  children: ReactNode
}) => (
  <DimContext.Provider value={dimmed}>
    {absolute ? (
      <Box
        position="absolute"
        flexDirection="column"
        width="100%"
        height={height}
      >
        {children}
      </Box>
    ) : (
      children
    )}
  </DimContext.Provider>
)

export const topLevelCount = (s: Section) =>
  s.items.filter(
    (i) =>
      i.kind !== "repo-header" && i.kind !== "subgroup-header" && !i.indent,
  ).length

export const drillCmd = (item: AnyItem): string | null => {
  if (item.kind === "task")
    return item.ticket ? `jira issue view ${item.ticket}` : null
  // pr / issue drill in-tree via mounted views (openDrillView)
  return null
}

const drillLabel = (item: AnyItem): string => {
  if (item.kind === "task") return "View ticket"
  if (item.kind === "issue") return "View issue"
  if (item.kind === "pr") return "Open PR"
  return "Drill in"
}

// Your own notification switch on one item, which GitHub exposes only as a
// GraphQL mutation over the node id. The inbox query does not carry one, and
// adding an id to every row to serve a single action is the wrong trade — so it
// is resolved here, once, at the moment the action actually runs.
//
// UNSUBSCRIBE, not IGNORED: ignoring is sticky in a way that is hard to notice
// later, and the row you are looking at is the one you want to stop hearing
// about, not the whole repo. Repo-level unwatching is a different verb and
// deliberately not offered here.
//
// Idempotent — unsubscribing twice succeeds, so the action does not need to know
// whether you were subscribed in the first place.
const UNSUBSCRIBE_MUTATION = `
  mutation($id: ID!) {
    updateSubscription(input: { subscribableId: $id, state: UNSUBSCRIBED }) {
      subscribable { viewerSubscription }
    }
  }
`

const unsubscribeFrom = async (item: GHItem): Promise<void> => {
  const view = item.kind === "pr" ? "pr" : "issue"
  const found =
    await quietly`gh ${view} view ${item.number} --repo ${item.repo} --json id --jq .id`
  const id = found.stdout.trim()
  // gh exits 0 having printed nothing when --jq finds no key, so an empty id is
  // the shape a failure arrives in — not an exception.
  if (!id) throw new Error(`no node id for ${item.repo}#${item.number}`)
  await quietly`gh api graphql -f query=${UNSUBSCRIBE_MUTATION} -f id=${id}`
}

export const buildActions = (
  item: AnyItem,
  login: string,
  showFlash: (msg: string) => void,
  jiraBase?: string,
  jiraKeyRe?: RegExp,
  jiraTransitions?: JiraTransition[],
  onRefresh?: () => void,
  onRemove?: (item: GHItem) => void,
  onOpenView?: (item: AnyItem) => boolean,
  // A trailing bag rather than two more positional params. Nine was already too
  // many, and the next contribution should extend this instead of growing the tail.
  ext?: {
    extensions?: InboxExtension[]
    onOpenExt?: (id: string, target: ExtensionTarget) => void
    /**
     * A mutation landed. Drops the cached glance now and schedules the refresh,
     * replacing a bare `setTimeout(onRefresh, 1500)` at each call site.
     *
     * Both halves matter and only one is visible: the delay lets GitHub settle,
     * the drop stops the pre-action cache outliving a quit inside that window.
     */
    onActed?: () => void
  },
): Action[] => {
  if (
    item.kind === "repo-header" ||
    item.kind === "subgroup-header" ||
    item.kind === "show-more" ||
    item.kind === "show-less"
  )
    return []

  const open: Action = {
    label: "Open in browser",
    hint: "o",
    run: () => {
      quietly`open ${item.url}`.catch(() => {})
      showFlash("↗ Opened in browser")
    },
  }

  const copyUrl: Action = {
    label: "Copy URL",
    hint: "c",
    run: () => {
      clipboard(item.url)
      const label = item.kind === "task" ? item.key : `#${item.number}`
      showFlash(`✓ Copied URL for ${label}`)
    },
  }

  // pr / issue mount an in-tree view (openDrillView via onOpenView); a ticket-backed task still
  // spawns a pane (drillCmd). Show the drill action whenever either path exists,
  // so "d" is always in the ↵ menu — not only when there's a pane command.
  const drill = drillCmd(item)
  const mountable = item.kind === "pr" || item.kind === "issue"
  const drillAction: Action | null =
    drill || (mountable && onOpenView)
      ? {
          label: drillLabel(item),
          hint: "d",
          run: () => {
            if (onOpenView?.(item)) return
            if (drill) {
              void runInPane(drill).catch(() => {})
              showFlash(`↗ ${drillLabel(item)}`)
            }
          },
        }
      : null

  if (item.kind === "task") {
    const base: Action[] = drillAction
      ? [drillAction, open, copyUrl]
      : [open, copyUrl]
    if (item.ticket && jiraTransitions && jiraTransitions.length > 0) {
      base.push({
        label: "Move status",
        hint: "t",
        run: () => {},
        subActions: jiraTransitions.map(({ label, transition, resolutions }) =>
          resolutions && resolutions.length > 0
            ? {
                label,
                hint: "",
                run: () => {},
                subActions: resolutions.map((resolution) => ({
                  label: resolution,
                  hint: "",
                  run: () => {
                    showFlash(`⋯ ${label} · ${resolution}…`)
                    void quietly`jira issue move ${
                      (item as TaskRow).ticket
                    } ${transition} --resolution ${resolution}`
                      .then(() => {
                        showFlash(`✓ ${label} · ${resolution}`)
                        ext?.onActed?.()
                      })
                      .catch(() => showFlash(`✗ Move to ${label} failed`))
                  },
                })),
              }
            : {
                label,
                hint: "",
                run: () => {
                  showFlash(`⋯ Moving to ${label}…`)
                  void quietly`jira issue move ${
                    (item as TaskRow).ticket
                  } ${transition}`
                    .then(() => {
                      showFlash(`✓ Moved to ${label}`)
                      ext?.onActed?.()
                    })
                    .catch(() => showFlash(`✗ Move to ${label} failed`))
                },
              },
        ),
      })
    }
    return base
  }

  const actions: Action[] = drillAction
    ? [drillAction, open, copyUrl]
    : [open, copyUrl]

  actions.push({
    label: "Copy repo name",
    hint: "r",
    run: () => {
      clipboard(item.repo)
      showFlash(`✓ Copied ${item.repo}`)
    },
  })

  // Only where a review was actually REQUESTED of you — `queued` is exactly
  // that, and the one standing where removing yourself does anything. On a PR
  // you already reviewed (`spoken`) there is no request left to withdraw, and
  // `gh pr edit` would fail on someone who is not a reviewer.
  //
  // This is the answer to "stop showing me this PR" that Unsubscribe is NOT.
  // Unsubscribing stops notifications and leaves every search matching, because
  // `review-requested:@me` does not consult subscription state — the row comes
  // straight back. Dropping the request removes the row at its cause.
  //
  // Two things can undo it, and neither is a bug here: a CODEOWNERS rule
  // covering the touched paths re-requests you on the next push, and a request
  // that arrived through a TEAM cannot be withdrawn for you alone.
  if (item.kind === "pr" && item.standing === "queued" && login) {
    actions.push({
      label: "Remove me as reviewer",
      hint: "x",
      run: () => {
        // Optimistic, then restored by a refresh if GitHub refuses — the same
        // shape Close uses. A row that vanishes and returns reads as a failure;
        // one that lingers for a round trip reads as a broken keypress.
        onRemove?.(item as GHItem)
        showFlash(`⋯ Removing you from #${item.number}…`)
        void quietly`gh pr edit ${item.number} --repo ${item.repo} --remove-reviewer ${login}`
          .then(() => {
            showFlash(`✓ Removed you as reviewer on #${item.number}`)
            ext?.onActed?.()
          })
          .catch(() => {
            showFlash(`✗ Could not remove you from #${item.number}`)
            onRefresh?.()
          })
      },
    })
  }

  actions.push({
    label: "Unsubscribe",
    hint: "u",
    run: () => {
      showFlash(`⋯ Unsubscribing from #${item.number}…`)
      void unsubscribeFrom(item as GHItem)
        .then(() => showFlash(`✓ Unsubscribed from #${item.number}`))
        .catch(() => showFlash(`✗ Unsubscribe failed for #${item.number}`))
    },
  })

  if (item.kind === "pr" && item.branch) {
    actions.push({
      label: "Copy branch name",
      hint: "b",
      run: () => {
        clipboard(item.branch!)
        showFlash(`✓ Copied ${item.branch}`)
      },
    })
  }

  if (item.kind === "pr" && item.branch) {
    actions.push({
      label: "Switch here",
      hint: "s",
      run: () => {
        const script = [
          "delay 0.5",
          'tell application "iTerm2"',
          "  tell current session of current window",
          `    write text "git switch ${item.branch}"`,
          "  end tell",
          "end tell",
        ].join("\n")
        const proc = spawn("osascript", ["-e", script], {
          detached: true,
          stdio: "ignore",
        })
        proc.unref()
        process.exit(0)
      },
    })
  }

  if (item.kind === "issue") {
    actions.push({
      label: "Open project in new tab",
      hint: "j",
      run: () => {
        showFlash(`⋯ Opening ${item.repo}…`)
        void jumpToRepo(item.repo, "", login)
          .then(() => showFlash(`↗ Opened ${item.repo} in new tab`))
          .catch(() => showFlash("✗ Jump failed"))
      },
    })
    actions.push({
      label: "Open project in new pane",
      hint: "p",
      run: () => {
        showFlash(`⋯ Opening pane for ${item.repo}…`)
        void jumpToRepoPane(item.repo, "", login)
          .then(() => showFlash(`↗ Opened ${item.repo} in new pane`))
          .catch(() => showFlash("✗ Pane failed"))
      },
    })
    actions.push({
      label: "Close issue",
      hint: "",
      run: () => {},
      subActions: [
        {
          label: `Close #${item.number}`,
          hint: "",
          run: () => {
            onRemove?.(item as GHItem)
            showFlash(`✓ Closed #${item.number}`)
            void quietly`gh issue close ${item.number} --repo ${item.repo}`.catch(
              () => {
                showFlash(`✗ Close failed — restoring #${item.number}`)
                onRefresh?.()
              },
            )
          },
        },
        { label: "Cancel", hint: "", run: () => {} },
      ],
    })
  }

  if (item.kind === "pr") {
    actions.push({
      label: "Switch in new tab",
      hint: "j",
      run: () => {
        showFlash(`⋯ Jumping to ${item.repo}…`)
        void jumpToRepo(item.repo, item.branch ?? "", login)
          .then(() => showFlash(`↗ Opened ${item.repo} in new tab`))
          .catch(() => showFlash("✗ Jump failed"))
      },
    })
    actions.push({
      label: "Switch in new pane",
      hint: "p",
      run: () => {
        showFlash(`⋯ Opening pane for ${item.repo}…`)
        void jumpToRepoPane(item.repo, item.branch ?? "", login)
          .then(() => showFlash(`↗ Opened ${item.repo} in new pane`))
          .catch(() => showFlash("✗ Pane failed"))
      },
    })
    if (jiraBase && jiraKeyRe) {
      const jiraKey = !item.indent ? item.title.match(jiraKeyRe)?.[0] : null
      if (jiraKey) {
        actions.push({
          label: `Open ${jiraKey} in Jira`,
          hint: "t",
          run: () => {
            quietly`open ${jiraBase}/${jiraKey}`.catch(() => {})
            showFlash(`↗ Opened ${jiraKey} in Jira`)
          },
        })
      }
    }

    actions.push({
      label: "Close PR",
      hint: "",
      run: () => {},
      subActions: [
        {
          label: `Close #${item.number}`,
          hint: "",
          run: () => {
            onRemove?.(item as GHItem)
            showFlash(`✓ Closed #${item.number}`)
            void quietly`gh pr close ${item.number} --repo ${item.repo}`.catch(
              () => {
                showFlash(`✗ Close failed — restoring #${item.number}`)
                onRefresh?.()
              },
            )
          },
        },
        { label: "Cancel", hint: "", run: () => {} },
      ],
    })

    if (item.branch) {
      actions.push({
        label: "Close PR + Delete branch",
        hint: "",
        run: () => {},
        subActions: [
          {
            label: `Close #${item.number} + delete ${item.branch}`,
            hint: "",
            run: () => {
              onRemove?.(item as GHItem)
              showFlash(`✓ Closed #${item.number} and deleted ${item.branch}`)
              void quietly`gh pr close ${item.number} --repo ${item.repo}`
                .then(
                  () =>
                    quietly`gh api -X DELETE ${`repos/${item.repo}/git/refs/heads/${item.branch}`}`,
                )
                .catch(() => {
                  showFlash(`✗ Close + delete failed — restoring`)
                  onRefresh?.()
                })
            },
          },
          { label: "Cancel", hint: "", run: () => {} },
        ],
      })
    }
  }

  // Item-scoped extensions, appended last so a domain contribution never displaces
  // the row's own actions. Reached only on GitHub rows — a Jira row returns from its
  // own branch above, and listing "Delegate to an agent" there would offer an action
  // whose only possible outcome is bouncing straight back.
  for (const e of itemExtensions(ext?.extensions))
    actions.push({
      label: e.title,
      hint: e.key,
      run: () => ext?.onOpenExt?.(e.id, { item, login }),
    })

  return actions
}

const agoText = (ms: number): string => {
  const d = (Date.now() - ms) / 1000
  if (d < 60) return "just now"
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

/** "board" → "🚀 Board". The glyph is shared; the word is the host's. */
const brandOf = (title: string): string =>
  `🚀 ${title[0].toUpperCase()}${title.slice(1)}`

const InboxHeader = ({
  sections,
  login,
  brand,
  scopeLabel,
  loading,
  quiet,
  refreshing,
  hasPending,
  pendingSummary,
  fetchedAt,
}: {
  sections: Section[]
  login: string
  // The name in the top-left, host-supplied. It is also measured for the rule
  // that fills the rest of the line, so it cannot be a hardcoded literal.
  brand: string
  /** The active scope, in the host's words. Absent, nothing is shown. */
  scopeLabel?: string
  loading?: boolean
  quiet?: boolean
  refreshing?: boolean
  hasPending?: boolean
  /** `2 new · 1 gone`, when a pending refresh is waiting. */
  pendingSummary?: string
  fetchedAt?: number | null
}) => {
  const total = sections.reduce((n, s) => n + topLevelCount(s), 0)
  // padStart, not padEnd: the count needs a stable width so the header doesn't
  // shuffle as it changes, but padding after the digits splits "47" from
  // "items". The slack belongs in front of the number, where it reads as a gap
  // between the title and the count rather than a hole inside a phrase.
  // `quiet` is not `loading`: a fetch that came back empty or failed has nothing
  // to count and nobody to attribute it to, but it is emphatically no longer
  // loading — and "0 items · @" reads as data that half-arrived.
  const countSeg = loading
    ? "      loading…  "
    : quiet
      ? "  "
      : `  ${String(total).padStart(3)} item${total !== 1 ? "s" : ""}  ·  `
  const userSeg = loading || quiet ? "" : `@${login}  `
  // A LABEL, not a control, and the HOST'S WORD rather than one of ours. Which
  // side you are on is settled when the command starts, so a switch here would
  // advertise a keypress that does nothing — but it still has to be on screen,
  // because every row you can see depends on it and two sides of a split look
  // alike enough that "where are my other PRs" is the question this answers.
  //
  // The package has no opinion on what the sides are called. It printed "work"
  // and "home" until 2026-08-27, which was one reader's vocabulary showing
  // through a library anyone can install.
  const workLabel = scopeLabel ? `  ${scopeLabel}  ` : ""

  // Refresh status: pending (actionable) wins, then in-flight, then freshness.
  // Naming the change is the whole argument for keeping the apply manual: the
  // gate is only worth its keypress if it tells you what you would be applying.
  const [statusText, statusColor] = hasPending
    ? [`● ${pendingSummary || "new"} · r apply`, "#FF8700"]
    : refreshing
      ? ["↻ refreshing…", "cyan"]
      : fetchedAt
        ? [`updated ${agoText(fetchedAt)}`, undefined]
        : ["", undefined]
  const statusSeg = statusText ? statusText + "  " : ""

  const fill = Math.max(
    4,
    COLS -
      brand.length -
      countSeg.length -
      userSeg.length -
      workLabel.length -
      statusSeg.length,
  )
  return (
    <Box marginBottom={1}>
      <Text color="#FF8700" bold>
        {brand}
      </Text>
      <Text dimColor>{countSeg}</Text>
      {userSeg ? <Text>{userSeg}</Text> : null}
      {scopeLabel ? <Text dimColor>{workLabel}</Text> : null}
      {statusText ? (
        <Text
          color={statusColor as any}
          dimColor={!statusColor}
          bold={hasPending}
        >
          {statusSeg}
        </Text>
      ) : null}
      <Text color="cyan" dimColor>
        {"╌".repeat(fill)}
      </Text>
    </Box>
  )
}

// A standing single-line row, always the same height (one line + marginBottom)
// across loading/error/ready so the content below it never jumps.
export type CiStatusState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; status: CiStatus }

export const toCiStatusState = (status: CiStatus | null): CiStatusState =>
  status ? { kind: "ready", status } : { kind: "error" }

// Same *meaningful* CI state? Compared on the build identity (job + number +
// result + building), deliberately ignoring `age`/`url` — age drifts every
// poll, and repainting the whole screen just because "3m" ticked to "4m" is
// exactly the flicker we're avoiding. Used to skip no-op setState on each poll.
export const sameCiStatusState = (
  a: CiStatusState,
  b: CiStatusState,
): boolean => {
  if (a.kind !== b.kind) return false
  if (a.kind !== "ready" || b.kind !== "ready") return true
  return (
    a.status.job === b.status.job &&
    a.status.buildNumber === b.status.buildNumber &&
    a.status.result === b.status.result &&
    a.status.building === b.status.building
  )
}

export const jenkinsResultDisplay = (
  result: string,
  building: boolean,
): [string, string] => {
  if (building) return ["*", "yellow"]
  if (result === "SUCCESS") return ["✓", "green"]
  if (result === "FAILURE" || result === "ABORTED") return ["✗", "red"]
  if (result === "UNSTABLE") return ["±", "yellow"]
  return ["·", "#888888"]
}

// ─── Explain ──────────────────────────────────────────────────────────────────

// A row's state rendered as sentences, derived entirely from data already
// fetched — no model, no second request. Every clause names the glyph it is
// explaining, so reading one teaches the vocabulary rather than replacing it.

export const CiStatusLine = ({
  state,
  job,
}: {
  state: CiStatusState
  job?: string
}) => {
  const name = job ?? "ci"
  if (state.kind === "loading")
    return (
      <Box marginBottom={1}>
        <Text dimColor>{"  · "}</Text>
        <Text dimColor>{`${name}  loading…`}</Text>
      </Box>
    )

  // "no build / not configured" rather than "unavailable": this state is a null
  // from the fetcher, which means Jenkins has no credentials or the job has no
  // builds — never a permissions failure. A failed request keeps the last-known
  // status instead, so "unavailable" read as "you lost access" and sent a real
  // debugging session down the wrong path.
  if (state.kind === "error")
    return (
      <Box marginBottom={1}>
        <Text color="red" bold>
          {"  ✗ "}
        </Text>
        <Text dimColor>{`${name}  no build / not configured`}</Text>
      </Box>
    )

  const { status } = state
  const [, color] = jenkinsResultDisplay(status.result, status.building)
  const label = status.building ? "BUILDING" : status.result
  return (
    <Box marginBottom={1}>
      <Text dimColor>{"  "}</Text>
      <Text color={color as any} bold>
        {"● "}
      </Text>
      <Text bold>{status.job}</Text>
      <Text dimColor>{"  " + label}</Text>
      <Text color="#FF8700">{"  #" + status.buildNumber}</Text>
      {status.age ? <Text dimColor>{"  " + status.age}</Text> : null}
    </Box>
  )
}

const RepoHeaderRow = ({ repo, gap }: { repo: string; gap: boolean }) => {
  const label = `── ${repo} `
  const fill = Math.max(4, 46 - label.length)
  return (
    <Box marginTop={gap ? 1 : 0}>
      <Text dimColor>{"  " + label + "─".repeat(fill)}</Text>
    </Box>
  )
}

// A merged PR gets a moment before it goes. Without it the row simply vanishes
// on the next refresh, so the one action in this UI that ends a piece of work is
// also the only one with no acknowledgement at all.
//
// MERGED is a word, not a colour: kud is colourblind, and purple here only
// reinforces what the label already says — the same rule healthDisplay follows
// for every other state in this list.
export const MERGED_HOLD_MS = 5000
export const MERGED_FRAME_MS = 150
const MERGED_FRAMES = ["✦", "✧", "✶", "✧"]
const MERGED_COLOUR = "#A371F7"

// How long a refreshed row stays flagged, counted only while its own tab is on
// screen. Longer than the merge sparkle, which celebrates something you did
// yourself a second ago and already knew about; this is reporting work that
// happened in another window while you were reading something else, so it has
// to survive being noticed rather than just seen.
export const TRANSIT_HOLD_MS = 7000
// One shared empty map, so clearing the marks compares equal to already-clear
// and React skips the repaint instead of redrawing the list to change nothing.
const NO_TRANSIENTS: Map<string, Transient> = new Map()
// Dissolving and coalescing, so the direction of travel is in the SHAPE. Read
// them as one animation played forwards and backwards: a row on its way out
// thins to a dot, a row arriving fills in from one.
const TRANSIT_OUT_FRAMES = ["◉", "◎", "○", "·"]
const TRANSIT_IN_FRAMES = ["·", "○", "◎", "◉"]
// Reinforcement only. NEW / GONE / UPDATED below are the actual signal, for the
// same reason MERGED is a word: kud is colourblind, and a marker that lives only
// in the hue is a marker he does not have.
const TRANSIT_COLOUR: Record<Transient, string> = {
  in: "#3FB950",
  out: "#8B949E",
  changed: "#FF8700",
}
const TRANSIT_LABEL: Record<Transient, string> = {
  in: "NEW",
  out: "GONE",
  changed: "UPDATED",
}
// A tab still holding marks wears a dot. Presence, not hue — Tabs dims every
// inactive label to the same grey, so a coloured marker would be no marker at
// all on exactly the tabs this exists to point at.
export const TAB_MARK = "●"

// The dot's cell is reserved on EVERY tab for as long as any tab wears one, so
// the bar moves twice per refresh — once when the news lands, once when the
// last tab settles — instead of twitching sideways each time a tab is read.
export const tabLabel = (
  label: string,
  marked: Set<string>,
  id: string,
): string =>
  marked.size === 0 ? label : `${marked.has(id) ? TAB_MARK : " "} ${label}`

// A row hanging off the one above it. `show-more` counts: it sits inside the
// group and closes it, so the last VISIBLE PR above it is a tee, not a corner.
const isChildRow = (item?: AnyItem): boolean =>
  !!item &&
  (item.kind === "show-more" ||
    item.kind === "show-less" ||
    ("indent" in item && item.indent === true))

const ItemRow = ({
  item,
  active,
  gap,
  login,
  merged,
  transient,
  lastChild,
  parent,
  sparkFrame = 0,
}: {
  item: AnyItem
  active: boolean
  gap?: boolean
  login?: string
  /**
   * This indented row is the last of its group, so it draws the corner and its
   * siblings above draw the tee. A row cannot know this about itself — it is a
   * fact about the row BELOW — so the list supplies it. Every child drew `└─`
   * before, which made a ticket with three PRs draw three closing corners and
   * no tree at all.
   */
  lastChild?: boolean
  /** This row has indented children hanging off it, so it opens the branch. */
  parent?: boolean
  /** Just merged from this cockpit: sparkle in place, then the row is dropped. */
  merged?: boolean
  /** What the refresh just did to this row, for the length of the hold. */
  transient?: Transient
  sparkFrame?: number
}) => {
  if (item.kind === "repo-header")
    return <RepoHeaderRow repo={item.repo} gap={gap ?? false} />

  if (item.kind === "subgroup-header")
    return (
      <Box marginTop={gap ? 1 : 0}>
        <Text color="#FF8700" bold>
          {"  » "}
        </Text>
        <Text bold>{item.label}</Text>
      </Box>
    )

  if (item.kind === "show-more")
    return (
      <Box>
        <Text color="cyan">{active ? "❯ " : "  "}</Text>
        <Text dimColor>{"└─ "}</Text>
        <Text dimColor>{active ? "↵ " : "  "}</Text>
        <Text dimColor>{`+${item.hidden.length} more`}</Text>
      </Box>
    )

  if (item.kind === "show-less")
    return (
      <Box>
        <Text color="cyan">{active ? "❯ " : "  "}</Text>
        <Text dimColor>{"└─ "}</Text>
        <Text dimColor>{active ? "↵ " : "  "}</Text>
        <Text dimColor>show less</Text>
      </Box>
    )

  if (item.kind === "task") {
    const note = item.note ?? ""
    // Same refresh vocabulary the GitHub row has always had, which this branch
    // returned before ever reaching: a row arriving coalesces, a row leaving
    // dissolves, and either way it says which in words. Without it a refresh on
    // a task-only surface (`life`) repainted silently — the list changed and
    // nothing on screen admitted it.
    //
    // The glyph gets a fixed cell of its own, present even when empty, for the
    // reason the GitHub row puts it in the health cell: every key and title on
    // screen is aligned off this column, so a marker that appears and vanishes
    // would shift the very row being watched.
    const transitIcon = !transient
      ? " "
      : transient === "out"
        ? (TRANSIT_OUT_FRAMES[sparkFrame % TRANSIT_OUT_FRAMES.length] as string)
        : transient === "in"
          ? (TRANSIT_IN_FRAMES[sparkFrame % TRANSIT_IN_FRAMES.length] as string)
          : "\u25C9"
    const transitLabel = transient ? TRANSIT_LABEL[transient] : ""
    const titleMax = Math.max(
      20,
      COLS - item.key.length - note.length - transitLabel.length - 12,
    )
    return (
      <Box marginTop={gap ? 1 : 0}>
        <Text color="cyan">{active ? "❯ " : "  "}</Text>
        <Text bold color={transient ? TRANSIT_COLOUR[transient] : undefined}>
          {transitIcon + " "}
        </Text>
        {/* The branch this ticket opens. Without it the PRs below hung off
            nothing — three corners in a column with no trunk above them, so the
            eye had to infer the grouping from indentation alone. `parent` is a
            fact about the row BELOW, which is why the list supplies it: a
            ticket whose PRs are all hidden behind `show-more`, or one with none
            at all, correctly draws no branch. The cell is fixed-width either
            way, so nothing shifts when a ticket gains or loses its last PR. */}
        <Text dimColor>{parent ? "┬ " : "  "}</Text>
        <Text color="#FF8700" bold={active}>
          {item.key + "  "}
        </Text>
        <Text
          bold={active || transient === "in"}
          dimColor={transient === "out"}
          strikethrough={transient === "out"}
        >
          {truncate(item.summary, titleMax)}
        </Text>
        {note ? <Text dimColor>{` ${note}`}</Text> : null}
        {transitLabel ? (
          <Text bold color={TRANSIT_COLOUR[transient!]}>
            {"  " + transitLabel}
          </Text>
        ) : null}
      </Box>
    )
  }

  const { glyph: healthIcon, color: healthColor } = healthDisplay[item.health]
  // The sparkle replaces the health glyph rather than sitting beside it: the
  // health column is one cell wide and every row's title is aligned off it, so
  // an extra glyph here would shift the title of exactly the row you are
  // watching. Health is also no longer the story — the PR is merged.
  // A leaving row dissolves and an arriving one coalesces, in the health cell,
  // for the same reason the merge sparkle does: that cell is one wide and every
  // title on screen is aligned off it, so a marker anywhere else would shift the
  // title of exactly the row being watched. `changed` deliberately KEEPS its
  // health glyph - the health is usually the thing that changed, and hiding it
  // to announce that it changed is the one substitution that costs information.
  const icon = merged
    ? (MERGED_FRAMES[sparkFrame % MERGED_FRAMES.length] as string)
    : transient === "out"
      ? (TRANSIT_OUT_FRAMES[sparkFrame % TRANSIT_OUT_FRAMES.length] as string)
      : transient === "in"
        ? (TRANSIT_IN_FRAMES[sparkFrame % TRANSIT_IN_FRAMES.length] as string)
        : healthIcon
  const color = merged
    ? MERGED_COLOUR
    : transient
      ? TRANSIT_COLOUR[transient]
      : healthColor
  // Whose turn it is, in its own fixed cell. Arrows rather than the nerd-font
  // comment glyph because this column sits in the aligned zone left of the
  // title: a PUA codepoint that renders double-width in some fonts would shift
  // only the rows that carry one, and a fixed cell exists precisely so the
  // title never moves. ← and → are already proven in this UI's footer hints.
  const spokeLast = !!login && !!item.lastActor && item.lastActor === login
  const [turnIcon, turnColor] =
    !login || !item.lastActor
      ? [" ", "white"]
      : spokeLast
        ? ["→", "#888888"]
        : ["←", "#FF8700"]
  const numStr = `#${item.number}`.padEnd(7)
  // Hide "by me" — the author suffix is only signal when it's someone else.
  const showAuthor = !!item.author && item.author !== login
  // Unresolved review threads — a comment glyph (nf-fa-comments) + count, keeping
  // to the single-glyph health vocabulary instead of spelling out "unresolved".
  const unresolvedLabel =
    item.unresolved > 0 ? `\u{f086} ${item.unresolved}` : ""
  // `3h · 2d` — active 3h ago, open for 2d. The left value is by construction
  // the smaller of the two (nothing can be touched before it exists), which is
  // what teaches the order without a legend, a colour or a second glyph column.
  // Collapsed to one value when they agree, so an untouched row does not read
  // as `2d · 2d`.
  const ageLabel =
    item.activityAge && item.activityAge !== item.age
      ? `${item.activityAge} · ${item.age}`
      : item.age
  const mergedLabel = merged ? "MERGED" : ""
  // Never both: a row merged from here is already being announced, and stacking
  // GONE onto MERGED would report one departure twice.
  const transitLabel = merged || !transient ? "" : TRANSIT_LABEL[transient]
  const suffix = [
    ageLabel || "",
    unresolvedLabel,
    showAuthor ? `by ${item.author}` : "",
    mergedLabel,
    transitLabel,
  ]
    .filter(Boolean)
    .join("  ")
  const repoLabel = item.indent ? item.repo : ""
  const fixedWidth =
    2 +
    (item.indent ? 3 : 0) +
    2 /* health */ +
    2 /* turn */ +
    7 +
    repoLabel.length +
    suffix.length +
    6
  const titleMax = Math.max(20, COLS - fixedWidth)

  return (
    <Box>
      <Text color="cyan">{active ? "❯ " : "  "}</Text>
      {item.indent ? (
        <Text dimColor>{lastChild === false ? "├─ " : "└─ "}</Text>
      ) : null}
      <Text color={color as any} bold>
        {icon + " "}
      </Text>
      <Text color={turnColor as any} bold={turnIcon === "←"}>
        {turnIcon + " "}
      </Text>
      <Text color="#FF8700">{numStr}</Text>
      <Text
        bold={active || transient === "in"}
        dimColor={transient === "out"}
        strikethrough={transient === "out"}
      >
        {truncate(item.title, titleMax) + "  "}
      </Text>
      {repoLabel ? <Text dimColor>{repoLabel}</Text> : null}
      {/* Follows the turn arrow, because an unresolved thread is not by itself
          a claim on you: GitHub keeps a thread open until someone clicks
          Resolve conversation, so replying leaves the count exactly where it
          was. Loud while the other side spoke last, quiet once you have
          answered — otherwise this cell reads "your turn" in orange one column
          from the arrow reading "not your turn" in grey. Never dimmed on an
          unknown turn (no login, no lastActor): a count we cannot attribute is
          still worth seeing. */}
      {unresolvedLabel ? (
        <Text bold={!spokeLast} color={spokeLast ? "#888888" : "#FF8700"}>
          {"  " + unresolvedLabel}
        </Text>
      ) : null}
      {showAuthor ? (
        <Text dimColor italic>
          {"  by " + item.author}
        </Text>
      ) : null}
      {/* Age last, so every row ends on the date — a consistent right edge. */}
      {ageLabel ? <Text dimColor>{"  " + ageLabel}</Text> : null}
      {/* Except for the three seconds a row is on its way out. */}
      {mergedLabel ? (
        <Text bold color={MERGED_COLOUR}>
          {"  " + mergedLabel}
        </Text>
      ) : null}
      {transitLabel ? (
        <Text bold color={TRANSIT_COLOUR[transient!]}>
          {"  " + transitLabel}
        </Text>
      ) : null}
    </Box>
  )
}

// The menu's whole state machine: cursor movement, descent into a confirm
// sub-menu, and dismissal. Shared by the inbox and the PR drill — a second
// hand-rolled copy would drift the first time one grew a case the other lacked.
// handleKey reports whether it consumed the key, so a host can bail out of its
// own keymap while the menu is up.
export const useActionMenu = () => {
  const [actions, setActions] = useState<Action[] | null>(null)
  const [cursor, setCursor] = useState(0)

  const open = (next: Action[]) => {
    if (next.length === 0) return
    setCursor(0)
    setActions(next)
  }

  const handleKey = (key: {
    upArrow?: boolean
    downArrow?: boolean
    return?: boolean
    escape?: boolean
  }): boolean => {
    if (!actions) return false
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow) setCursor((c) => Math.min(actions.length - 1, c + 1))
    if (key.return) {
      const action = actions[cursor]
      if (action?.subActions) {
        setCursor(0)
        setActions(action.subActions)
      } else {
        setActions(null)
        action?.run()
      }
    }
    if (key.escape) setActions(null)
    return true
  }

  return { actions, cursor, open, close: () => setActions(null), handleKey }
}

export const ActionMenu = ({
  item,
  actions,
  cursor,
}: {
  item: AnyItem
  actions: Action[]
  cursor: number
}) => {
  const title =
    item.kind === "task"
      ? item.key
      : item.kind === "pr" || item.kind === "issue"
        ? `#${item.number}`
        : ""
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      backgroundColor={OVERLAY_BG}
      paddingX={1}
      marginTop={1}
    >
      <Text color="cyan" bold>
        {title}
      </Text>
      <Text dimColor>{"─".repeat(32)}</Text>
      {actions.map((a, i) => (
        <Box key={a.label}>
          <Text color="cyan">{i === cursor ? "❯ " : "  "}</Text>
          <Text bold={i === cursor}>{a.label}</Text>
          <Text dimColor>{"  " + a.hint}</Text>
        </Box>
      ))}
      <Text dimColor>{"─".repeat(32)}</Text>
      <Text dimColor>↑↓ navigate ↵ confirm esc cancel</Text>
    </Box>
  )
}

// `?` legend: what the row glyphs mean, plus the full key map (including the
// context hotkeys that never fit in the footer). Two columns so it stays short
// vertically. Purely informational — any key closes it.
// The turn column's vocabulary, kept beside healthLegend so the two read as
// one system in the modal.
const TURN_LEGEND: [string, string, string][] = [
  ["←", "#FF8700", "They spoke last · your turn"],
  ["→", "#888888", "You spoke last · waiting on them"],
]

// Tab meanings are supplied by the caller rather than hardcoded: home's tabs are
// GitHub searches, work's are Jira statuses, and a list baked in here would be
// wrong in one of the two cockpits at all times.
type LegendRow = {
  cell: string
  label: string
  color?: string
  bold?: boolean
}
type LegendColumn = { title: string; rows: LegendRow[] }

const CELL_GUTTER = 2
const COL_GAP = 3

// The gutter between a row's cell and its label is derived from the widest cell
// in that column, never hardcoded. The three columns used to spell the same
// intent as `padEnd(10)` and `padEnd(11)`, so a longer key or tab name silently
// ate its own separator.
const cellWidthOf = (col: LegendColumn) =>
  Math.max(0, ...col.rows.map((r) => r.cell.length)) + CELL_GUTTER

const widthOf = (col: LegendColumn) =>
  Math.max(
    col.title.length,
    ...col.rows.map((r) => cellWidthOf(col) + r.label.length),
  )

const groupWidth = (group: LegendColumn[]) => Math.max(0, ...group.map(widthOf))

const layoutWidth = (groups: LegendColumn[][]) =>
  groups.reduce((total, g) => total + groupWidth(g), 0) +
  COL_GAP * Math.max(0, groups.length - 1)

// Three columns of legend need ~118 terminal columns, and nothing here used to
// say so: below that Ink wrapped every row mid-word and the modal came apart —
// borders out of step, labels split across lines, each row silently two rows
// tall. Rather than truncate, fall down a ladder of layouts: three across, then
// Status and Tabs stacked beside Keys, then everything in one column. Only the
// last is tall, and only a terminal too narrow for two columns ever sees it.
const legendLayout = (
  cols: LegendColumn[],
  available: number,
): LegendColumn[][] => {
  const across = cols.map((c) => [c])
  if (layoutWidth(across) <= available) return across
  const stacked = [cols.slice(0, -1), cols.slice(-1)]
  if (layoutWidth(stacked) <= available) return stacked
  return [cols]
}

// A group is flattened to its printed lines before anything renders it, because
// the modal has to be able to show a WINDOW of itself: a terminal short enough
// clips the panel from the top (Ink overflows upward inside the frame), which
// eats the "Legend" heading and the first rows without leaving any sign it did.
// Slicing a line list is the only way to scroll a layout whose columns each
// carry their own headings — margins cannot be sliced, so the blank line
// between stacked columns becomes a line of its own here.
type LegendLine =
  | { kind: "gap" }
  | { kind: "title"; text: string }
  | { kind: "row"; row: LegendRow; cellWidth: number }

const groupLines = (group: LegendColumn[]): LegendLine[] =>
  group.flatMap((col, index) => {
    const cellWidth = cellWidthOf(col)
    const head: LegendLine[] = index === 0 ? [] : [{ kind: "gap" }]
    return [
      ...head,
      { kind: "title", text: col.title } as LegendLine,
      ...col.rows.map((row): LegendLine => ({ kind: "row", row, cellWidth })),
    ]
  })

// Which column heading the window has scrolled PAST, so it can be reprinted
// above the slice. Without it a scrolled legend is a wall of glyphs and letters
// with nothing left saying which column is which — shorter, and no easier to
// read, which was the whole complaint.
const scrolledPastTitle = (lines: LegendLine[], offset: number) => {
  let seen: string | null = null
  for (let i = 0; i <= offset && i < lines.length; i++) {
    const line = lines[i]!
    if (line.kind === "title") seen = i === offset ? null : line.text
  }
  return seen
}

const LegendGroup = ({
  lines,
  pinned,
  width,
  marginRight,
}: {
  lines: LegendLine[]
  // null still renders a blank row: every group has to reserve the same height
  // or the columns beside it slide out of step with each other.
  pinned?: string | null
  width: number
  marginRight: number
}) => (
  <Box flexDirection="column" width={width} marginRight={marginRight}>
    {pinned !== undefined ? (
      <Text bold dimColor>
        {pinned ?? " "}
      </Text>
    ) : null}
    {lines.map((line, index) =>
      line.kind === "gap" ? (
        <Text key={index}> </Text>
      ) : line.kind === "title" ? (
        <Text key={index} bold dimColor>
          {line.text}
        </Text>
      ) : (
        <Box key={index}>
          <Text color={line.row.color as any} bold={line.row.bold}>
            {line.row.cell.padEnd(line.cellWidth)}
          </Text>
          <Text wrap="truncate-end">{line.row.label}</Text>
        </Box>
      ),
    )}
  </Box>
)

const LEGEND_FOOTNOTE =
  "Each item lands in the FIRST tab that claims it, so counts are residuals rather than totals."

export const HelpModal = ({
  extensions,
  hasJira,
  tabHelp,
  maxRows,
  scroll = 0,
  onScrollRange,
}: {
  // The extensions themselves, not a `hasCi` boolean. A flag could only ever say
  // "Jenkins exists", which is why a second extension went unlisted here.
  extensions?: InboxExtension[]
  hasJira?: boolean
  tabHelp?: [string, string][]
  // Rows the panel may occupy — the caller's list budget, not the terminal's
  // height, since the modal sits inside the frame with the header and tabs above
  // it. Absent (a standalone mount) it takes the terminal.
  maxRows?: number
  scroll?: number
  onScrollRange?: (maxScroll: number, bodyRows: number) => void
}) => {
  // Read live rather than through the module-level COLS, which is sampled once at
  // import and so cannot answer after a resize — the one thing this modal has to
  // get right.
  const { columns, rows } = useWindowSize()
  const available = Math.max(
    20,
    columns - FRAME_CHROME_COLS - MODAL_CHROME_COLS,
  )

  const keys: [string, string][] = [
    ["↑ ↓", "navigate"],
    ["← → · tab", "switch tab"],
    ["↵ · d", "open / drill in"],
    ["m", "actions · close"],
    ["e", "explain this row"],
    ["o", "open in browser"],
    ["c", "copy URL"],
    ["b", "copy branch"],
    ["s", "switch to branch here"],
    ["j", "open repo in new tab"],
    ["p", "open repo in new pane"],
    ["u", "unsubscribe from this item"],
    ["x", "remove yourself as reviewer"],
    ...(hasJira
      ? ([["t", "Jira: move / open ticket"]] as [string, string][])
      : []),
    ["/", "search"],
    ["f", "filter by repo"],
    ["r", "refresh"],
    ...extensionLegend(extensions),
    ["?", "this help"],
    ["q", "quit"],
  ]

  const statusColumn: LegendColumn = {
    title: "Status",
    rows: [
      ...healthLegend.map(([health, label]) => ({
        cell: healthDisplay[health].glyph,
        color: healthDisplay[health].color,
        bold: true,
        label,
      })),
      ...TURN_LEGEND.map(([cell, color, label]) => ({
        cell,
        color,
        bold: true,
        label,
      })),
      {
        cell: "\u{f086}",
        color: "#FF8700",
        bold: true,
        label: "Open-thread count",
      },
    ],
  }

  const cols: LegendColumn[] = [
    statusColumn,
    ...(tabHelp
      ? [
          {
            title: "Tabs",
            rows: tabHelp.map(([tab, meaning]) => ({
              cell: tab,
              color: "#FF8700",
              label: meaning,
            })),
          },
        ]
      : []),
    {
      title: "Keys",
      rows: keys.map(([key, label]) => ({ cell: key, color: "cyan", label })),
    },
  ]

  const groups = legendLayout(cols, available)
  const widths = groups.map((g) => Math.min(groupWidth(g), available))
  const contentWidth = Math.min(available, layoutWidth(groups))

  // The width ladder cannot help here: every rung is exactly as tall as its
  // tallest column, and the narrow rungs are the TALLER ones. So once the height
  // runs out there is nothing left to lay out differently — the panel shows a
  // window of itself and says so, rather than being silently topped.
  const lines = groups.map(groupLines)
  const totalRows = Math.max(0, ...lines.map((l) => l.length))
  const footnoteRows = tabHelp
    ? Math.ceil(LEGEND_FOOTNOTE.length / Math.max(1, contentWidth))
    : 0
  const chromeRows =
    2 /* border */ + 1 /* Legend */ + 1 /* blank */ + 1 /* esc */
  // Measured twice, because the panel spends its rows differently once it turns
  // out to be scrolling — and whether it is scrolling depends on how it spent
  // them. Roomy, it keeps the footnote; cramped, that gloss on the tab counts
  // gives up its two or three rows to the reprinted column heading, which is
  // load-bearing where the footnote is not.
  const fitWithin = (extra: number) => {
    const body = Math.max(3, (maxRows ?? rows) - chromeRows - extra)
    return { body, max: Math.max(0, totalRows - body) }
  }
  const loose = fitWithin(footnoteRows)
  const { body: bodyRows, max: maxScroll } =
    loose.max > 0 ? fitWithin(1) : loose
  const offset = Math.min(scroll, maxScroll)
  const scrollable = maxScroll > 0
  // When every group's window opens ON its own heading — the top of the legend,
  // and only there — the reprinted row IS that heading, so the slice starts past
  // it. Anywhere else the groups disagree about what sits at `offset`, and
  // skipping a line in one but not its neighbour slides the columns out of step.
  const headAligned =
    scrollable && lines.every((l) => l[offset]?.kind === "title")
  const pinnedOf = (l: LegendLine[]) => {
    const at = l[offset]
    return headAligned && at?.kind === "title"
      ? at.text
      : scrolledPastTitle(l, offset)
  }
  const bodyStart = offset + (headAligned ? 1 : 0)
  const shown = Math.min(totalRows - offset, bodyRows + (headAligned ? 1 : 0))

  // The window's bounds are reported UP rather than the keys being handled here,
  // the way RepoPicker's cursor already works: the inbox owns the one useInput
  // in this tree, and a second one inside a modal would need raw mode the moment
  // it mounted — which a test harness renders without, taking the whole panel
  // down to a blank line rather than failing where the mistake is.
  useEffect(() => {
    onScrollRange?.(maxScroll, bodyRows)
  }, [maxScroll, bodyRows])

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      backgroundColor={OVERLAY_BG}
      paddingX={1}
      width={contentWidth + MODAL_CHROME_COLS}
    >
      <Box>
        <Text color="cyan" bold>
          Legend
        </Text>
        {scrollable ? (
          <Text dimColor>
            {`   ${offset + 1}–${offset + shown} of ${totalRows}`}
          </Text>
        ) : null}
      </Box>
      <Box marginTop={1} width={contentWidth}>
        {groups.map((group, index) => (
          <LegendGroup
            key={group[0]?.title ?? index}
            lines={lines[index]!.slice(bodyStart, bodyStart + bodyRows)}
            pinned={scrollable ? pinnedOf(lines[index]!) : undefined}
            width={widths[index]!}
            marginRight={index === groups.length - 1 ? 0 : COL_GAP}
          />
        ))}
      </Box>
      {tabHelp && !scrollable ? <Text dimColor>{LEGEND_FOOTNOTE}</Text> : null}
      <Text dimColor>
        {scrollable ? "↑↓ scroll · esc · ? close" : "esc · ? close"}
      </Text>
    </Box>
  )
}

const ExplainModal = ({ item, login }: { item: GHItem; login: string }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="cyan"
    backgroundColor={OVERLAY_BG}
    paddingX={1}
    width={Math.min(COLS, 78)}
  >
    <Text color="#FF8700" bold>
      {`#${item.number} · ${item.repo}`}
    </Text>
    <Text>{item.title}</Text>
    {explainItem(item, login).map((section) => (
      <Box key={section.heading} flexDirection="column" marginTop={1}>
        <Text bold dimColor>
          {section.heading}
        </Text>
        {section.lines.map((line, i) => (
          <Text key={i}>{"  " + line}</Text>
        ))}
      </Box>
    ))}
    <Box marginTop={1}>
      <Text dimColor>esc · e close</Text>
    </Box>
  </Box>
)

const RepoPicker = ({
  repos,
  selected,
  cursor,
}: {
  repos: string[]
  selected: Set<string>
  cursor: number
}) => {
  const { rows } = useWindowSize()
  const budget = Math.max(6, rows - 12)
  const start = Math.max(
    0,
    Math.min(cursor - Math.floor(budget / 2), repos.length - budget),
  )
  const visible = repos.slice(start, start + budget)
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      backgroundColor={OVERLAY_BG}
      paddingX={1}
      minWidth={42}
    >
      <Text color="cyan" bold>
        {`Filter by repo  (${selected.size} on)`}
      </Text>
      <Text dimColor>{"─".repeat(36)}</Text>
      {visible.map((repo, i) => {
        const idx = start + i
        const on = selected.has(repo)
        const active = idx === cursor
        return (
          <Box key={repo}>
            <Text color="cyan">{active ? "❯ " : "  "}</Text>
            <Text color={on ? "green" : undefined}>{on ? "◉ " : "○ "}</Text>
            <Text bold={active}>{repo}</Text>
          </Box>
        )
      })}
      {repos.length > budget ? (
        <Text dimColor>{`  … ${repos.length} repos total`}</Text>
      ) : null}
      <Text dimColor>{"─".repeat(36)}</Text>
      <Text dimColor>space toggle · a clear all · ↵/esc done</Text>
    </Box>
  )
}

// Which extension a keypress opens, if any. Split out of the input handler so the
// empty-input guard is testable rather than incidental: Ink reports arrow keys,
// Tab and Escape with `input` as an empty string, so a matcher without the guard
// would fire any extension that declared `key: ""` on every single cursor move.
export const extensionFor = (
  input: string,
  extensions?: InboxExtension[],
): InboxExtension | undefined =>
  input ? extensions?.find((e) => e.key === input) : undefined

// The `?` legend, derived rather than hand-written. It used to hardcode
// `["J", "jenkins"]` behind a `ciStatus`/`hasCi` flag, so honouring `key` in the
// dispatch left `a` working and undiscoverable — the mechanism was generic and
// everything that ADVERTISED it still named one domain. The footer strip no longer
// lists extensions: it is fixed-width orientation, and every extension added would
// otherwise widen it until it wrapped.
export const extensionHints = (
  extensions?: InboxExtension[],
): [string, string][] =>
  (extensions ?? []).map((e) => [e.key, e.hint ?? e.title.toLowerCase()])

export const extensionLegend = (
  extensions?: InboxExtension[],
): [string, string][] => (extensions ?? []).map((e) => [e.key, e.title])

// Extensions that belong in a row's action menu. `scope` defaults to "global", so
// an extension has to opt IN to being listed against an item — a host that has not
// thought about it does not get Jenkins offered as something to do to a PR.
export const itemExtensions = (
  extensions?: InboxExtension[],
): InboxExtension[] => (extensions ?? []).filter((e) => e.scope === "item")

const BrowseScreen = ({
  sections,
  login,
  jiraBase,
  jiraKeyRe,
  jiraTransitions,
  onRefresh,
  onActed,
  refreshing,
  hasPending,
  pendingSummary,
  fetchedAt,
  refreshError,
  hidden,
  onOpenPr,
  onOpenIssue,
  onOpenExt,
  extensions,
  ciStatusState,
  ciJob,
  tabHelp,
  origin,
  brand,
  mergedUrls,
  transients,
  onTabChange,
}: {
  brand: string
  sections: Section[]
  login: string
  /** URLs of rows merged from this cockpit, still inside their hold. */
  mergedUrls?: string[]
  /** What the refresh just did to each row, for the length of the hold. */
  transients?: Map<string, Transient>
  /** Which tab is on screen, so the host can spend the hold per tab. */
  onTabChange?: (sectionId: string) => void
  origin?: OriginSplit
  tabHelp?: [string, string][]
  jiraBase?: string
  jiraKeyRe?: RegExp
  jiraTransitions?: JiraTransition[]
  onRefresh?: () => void
  /** A mutation landed: drop the cached glance now, refresh shortly. */
  onActed?: () => void
  refreshing?: boolean
  hasPending?: boolean
  pendingSummary?: string
  fetchedAt?: number | null
  // A background revalidate that failed. Carries `at` so two identical failures
  // in a row are still two distinct values — a bare string would compare equal
  // and the flash would fire only once, reading as "it recovered".
  refreshError?: { message: string; at: number }
  hidden?: boolean
  onOpenPr?: (item: GHItem) => void
  onOpenIssue?: (item: GHItem) => void
  onOpenExt?: (id: string, target?: ExtensionTarget) => void
  // Needed only to read each extension's `key`; the bodies are mounted by App,
  // not here. Without it BrowseScreen cannot dispatch on `key` at all, which is
  // what confined extensions to the hardcoded Jenkins arm.
  extensions?: InboxExtension[]
  // The CI line renders here, between the inbox header and the tabs. Its
  // full poll state (loading / error / ready) is passed so the row is always
  // present once wired; undefined means "no CI row at all" (home's cockpit).
  ciStatusState?: CiStatusState
  ciJob?: string
}) => {
  const { rows } = useWindowSize()
  // Both directions are the same filter with `keep` flipped, so the host supplies
  // one predicate rather than two filters. No predicate — or no side asked for —
  // and there is no split: every section stands.
  //
  // This used to be state behind a `w` toggle. It is a launch-time value now
  // because the answer comes from the directory the command was run in, and by
  // the time the inbox is on screen that is settled: a toggle could only ever
  // disagree with the scope you actually chose.
  const applyWork = (secs: Section[]): Section[] =>
    origin ? filterByOrigin(secs, origin.show, origin.match) : secs
  const initialSections = applyWork(sections)

  const [localSections, setLocalSections] = useState(initialSections)
  const [tabIdx, setTabIdx] = useState(0)

  // Keyed by section id, NOT by position. filterByOrigin drops sections that end
  // up empty, so the work ⇄ home switch changes the section SET, not just its
  // contents — position n is a different tab on the other side. Index-keyed state
  // meant flipping the switch handed you another tab's saved cursor.
  const [cursors, setCursors] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialSections.map((s) => [s.id, firstSelectable(s)])),
  )
  const [viewStarts, setViewStarts] = useState<Record<string, number>>({})

  const safeTabIdx = Math.min(tabIdx, Math.max(0, localSections.length - 1))
  const activeId = localSections[safeTabIdx]?.id ?? ""
  // Which tab is being read, told to whoever owns the transit hold. The tab
  // lives here — App only ever knew the whole list — so the news a refresh
  // brought could expire in a tab nobody had opened.
  useEffect(() => {
    onTabChange?.(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])
  const [flash, setFlash] = useState<string | null>(null)
  const menu = useActionMenu()
  const [search, setSearch] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(false)
  const [repoFilter, setRepoFilter] = useState<Set<string>>(new Set())
  const [repoPicker, setRepoPicker] = useState(false)
  const [help, setHelp] = useState(false)
  // Only ever non-zero on a terminal too short for the whole legend; the modal
  // reports what it can actually show and this follows it.
  const [helpScroll, setHelpScroll] = useState(0)
  const [helpRange, setHelpRange] = useState({ max: 0, page: 1 })
  const [explain, setExplain] = useState(false)
  const filterActive = search != null || repoFilter.size > 0
  // The CI row occupies 2 rows (content + margin); reserve them out of the
  // list's height budget so the tree never grows taller than the terminal
  // (Ink clips overflow from the top, which would eat the CI line).
  const reserveCiRow = ciStatusState != null
  const ciStatus = ciStatusState?.kind === "ready" ? ciStatusState.status : null
  const listHeight = Math.max(
    5,
    // -10 rather than -8: the extra 2 are the frame's top and bottom border
    // rows, so the tree never grows taller than the terminal inside the frame.
    rows - 10 - (filterActive ? 2 : 0) - (reserveCiRow ? 2 : 0),
  )

  useEffect(() => {
    setCursors((p) => ({ ...p, [activeId]: 0 }))
    setViewStarts((p) => ({ ...p, [activeId]: 0 }))
  }, [search])

  // Pull in fresh data when App applies it (no longer via a loading remount).
  useEffect(() => {
    setLocalSections(applyWork(sections))
  }, [sections])

  useEffect(() => {
    setTabIdx((prev) => Math.min(prev, Math.max(0, localSections.length - 1)))
    setCursors((prev) =>
      Object.fromEntries(
        localSections.map((s) => {
          const c = Math.min(
            prev[s.id] ?? firstSelectable(s),
            s.items.length - 1,
          )
          if (c < 0) return [s.id, 0]
          return [
            s.id,
            s.items[c]?.kind === "repo-header" ||
            s.items[c]?.kind === "subgroup-header"
              ? moveCursor(s.items, c, 1)
              : c,
          ]
        }),
      ),
    )
    setViewStarts((prev) =>
      Object.fromEntries(
        localSections.map((s) => [
          s.id,
          Math.min(prev[s.id] ?? 0, maxViewStart(s.items, listHeight)),
        ]),
      ),
    )
  }, [localSections, listHeight])

  const removeItemFromSections = (target: GHItem) =>
    setLocalSections((prev) => withoutItem(prev, target))

  const rawSection = localSections[safeTabIdx] ?? {
    id: "empty",
    label: "",
    items: [],
  }
  const searched =
    search != null ? filterBySearch([rawSection], search) : [rawSection]
  const filtered =
    repoFilter.size > 0 ? filterByRepos(searched, repoFilter) : searched
  const section = filterActive
    ? { ...rawSection, items: filtered[0]?.items ?? [] }
    : rawSection
  const allRepos = reposInSections(localSections)

  // The one cursor in this file useListCursor fits: a flat list with a uniform
  // step. The main tree's cursor moves through moveCursor, which SKIPS header
  // rows, so ±1 is the wrong step there — see the note on the tree's handlers.
  // vimKeys off keeps the picker's keymap byte-for-byte what it was.
  const { cursor: repoCursor, setCursor: setRepoCursor } = useListCursor(
    allRepos.length,
    { vimKeys: false, isActive: repoPicker },
  )
  const cursor = cursors[activeId] ?? 0
  const viewStart = viewStarts[activeId] ?? 0
  const visibleCount = windowCount(section.items, viewStart, listHeight)
  const visibleItems = section.items.slice(viewStart, viewStart + visibleCount)
  const hasMore = viewStart + visibleCount < section.items.length
  const activeItem = section.items[cursor]

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2000)
  }

  // Which tabs are still holding news nobody has read. The marker itself lives
  // on the row, in a tab that may not be open — so without this the hold keeps
  // its promise perfectly and nothing ever tells you to go and collect on it.
  const markedTabs = useMemo(() => {
    const out = new Set<string>()
    if (!transients?.size) return out
    for (const s of localSections)
      if (s.items.some((item) => transientOf(transients, item))) out.add(s.id)
    return out
  }, [localSections, transients])

  // ONE interval for every sparkling row, not one per row: the frame is shared,
  // so N timers would only produce N chances to fall out of step. It runs solely
  // while something is merging and is cleared the moment the last row goes, so a
  // cockpit sitting idle redraws exactly as often as it did before.
  //
  // Scoped to what this tab draws, not to the marks as a whole: a mark now
  // waits for its own tab to be opened, so an untouched tab would otherwise
  // keep the ticker running against rows nobody can see.
  const [sparkFrame, setSparkFrame] = useState(0)
  const sparkling =
    (mergedUrls?.length ?? 0) > 0 ||
    (!!transients?.size &&
      section.items.some((item) => transientOf(transients, item)))
  useEffect(() => {
    if (!sparkling) return
    const id = setInterval(() => setSparkFrame((f) => f + 1), MERGED_FRAME_MS)
    return () => clearInterval(id)
  }, [sparkling])

  // A failed background refresh used to be swallowed: the list kept rendering
  // from cache with no hint it had gone stale, and the only thing the user saw
  // was whatever the fetcher's child process leaked to stderr — outside the
  // frame, where nothing can lay it out. It belongs in the flash, inside the
  // border, like every other transient outcome in this UI.
  useEffect(() => {
    if (refreshError) showFlash(`✗ ${refreshError.message}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshError])

  const openDrillView = (item: AnyItem): boolean => {
    const open = (fn: (i: GHItem) => void, i: GHItem): boolean => {
      menu.close()
      fn(i)
      return true
    }
    if (item.kind === "pr" && onOpenPr) return open(onOpenPr, item)
    if (item.kind === "issue" && onOpenIssue) return open(onOpenIssue, item)
    return false
  }

  const openMenu = () => {
    if (
      !activeItem ||
      activeItem.kind === "repo-header" ||
      activeItem.kind === "subgroup-header"
    )
      return
    const actions = buildActions(
      activeItem,
      login,
      (msg) => {
        menu.close()
        showFlash(msg)
      },
      jiraBase,
      jiraKeyRe,
      jiraTransitions,
      onRefresh,
      removeItemFromSections,
      openDrillView,
      { extensions, onOpenExt, onActed },
    )
    menu.open(actions)
  }

  useInput((input, key) => {
    if (hidden) return
    // Every shortcut below is a bare letter/arrow with no modifier — none of
    // them are meant to fire on a ctrl/meta chord. Without this, a Ctrl+<key>
    // press (e.g. the very common Ctrl+D shell reflex) is indistinguishable
    // from the plain key at the `input` level (readline reports it as the
    // same letter with key.ctrl set), so it'd silently trigger that letter's
    // action — including drilling into whatever row is active.
    if (key.ctrl || key.meta) return

    // Help legend is a pure overlay: any key dismisses it, and nothing else
    // is processed while it's up — bar the four that scroll it, and only while
    // it is actually taller than the room it was given.
    if (help) {
      if (helpRange.max > 0) {
        const step = (n: number) =>
          setHelpScroll((s) => Math.min(helpRange.max, Math.max(0, s + n)))
        if (key.upArrow) return step(-1)
        if (key.downArrow) return step(1)
        if (key.pageUp) return step(-helpRange.page)
        if (key.pageDown) return step(helpRange.page)
      }
      setHelp(false)
      return
    }
    if (input === "?") {
      setHelpScroll(0)
      setHelp(true)
      return
    }

    if (explain) {
      setExplain(false)
      return
    }

    if (repoPicker) {
      // ↑↓ belong to useListCursor above, gated on repoPicker.
      if (key.escape || key.return) return setRepoPicker(false)
      if (input === "a") return setRepoFilter(new Set())
      if (input === " ") {
        const repo = allRepos[repoCursor]
        if (repo)
          setRepoFilter((prev) => {
            const next = new Set(prev)
            if (next.has(repo)) next.delete(repo)
            else next.add(repo)
            return next
          })
      }
      return
    }

    if (searchInput) {
      if (key.return) return setSearchInput(false)
      if (key.escape) {
        setSearch(null)
        return setSearchInput(false)
      }
      if (key.backspace || key.delete)
        return setSearch((s) => (s ?? "").slice(0, -1))
      if (input && !key.ctrl && !key.meta && !key.tab)
        return setSearch((s) => (s ?? "") + input)
      return
    }
    if (input === "/") {
      setSearch("")
      setSearchInput(true)
      return
    }
    if (input === "f" && allRepos.length > 0) {
      setRepoCursor(0)
      setRepoPicker(true)
      return
    }
    if (key.escape && search != null) {
      setSearch(null)
      return
    }
    if (key.escape && repoFilter.size > 0) {
      setRepoFilter(new Set())
      return
    }

    if (menu.handleKey(key)) return

    // Not useListCursor / useTabs, and not an oversight. The cursor steps through
    // moveCursor, which skips repo-header and subgroup-header rows, so the hook's
    // ±1 would land on a header. And tabIdx stays a position with its own clamp
    // while useTabs owns a tab VALUE — adopting it would add a derived index and a
    // clamp effect on top, to replace four correct lines. The repo picker above is
    // the fit; this is not.
    if (key.upArrow) {
      const next = moveCursor(section.items, cursor, -1)
      const newVs = Math.min(viewStart, withHeaders(section.items, next))
      setCursors((p) => ({ ...p, [activeId]: next }))
      setViewStarts((p) => ({ ...p, [activeId]: newVs }))
    }
    if (key.downArrow) {
      const next = moveCursor(section.items, cursor, 1)
      let newVs = viewStart
      while (next >= newVs + windowCount(section.items, newVs, listHeight))
        newVs++
      setCursors((p) => ({ ...p, [activeId]: next }))
      setViewStarts((p) => ({ ...p, [activeId]: newVs }))
    }
    if (key.leftArrow) setTabIdx((i) => Math.max(0, i - 1))
    if (key.rightArrow)
      setTabIdx((i) => Math.min(localSections.length - 1, i + 1))
    if (key.tab)
      setTabIdx(
        (i) =>
          (i + (key.shift ? -1 : 1) + localSections.length) %
          localSections.length,
      )
    if (input === "q") process.exit(0)
    if (input === "r") {
      onRefresh?.()
      return
    }
    // Any extension whose declared key is pressed opens it. This used to be a
    // hardcoded `input === "J"` arm calling onOpenExt("jenkins", …), which made
    // InboxExtension.key decorative — the field existed, BrowseScreen never
    // received the array, and a second extension could declare a key that nothing
    // would ever read. The position is deliberate: below every built-in binding,
    // so a declared key cannot shadow navigation, refresh or quit, and above the
    // activeItem guard, so a domain-scoped extension still opens on an empty tab.
    // Both contexts travel in the target and the body takes what it needs —
    // Jenkins reads ciJob, a row-scoped extension reads item.
    const ext = extensionFor(input, extensions)
    if (ext) {
      onOpenExt?.(ext.id, {
        item: activeItem ?? undefined,
        ciJob: ciStatus?.job,
        login,
      })
      return
    }
    if (
      !activeItem ||
      activeItem.kind === "repo-header" ||
      activeItem.kind === "subgroup-header"
    )
      return

    if (key.return && activeItem.kind === "show-more") {
      setLocalSections((prev) =>
        prev.map((s) => ({
          ...s,
          items: s.items.flatMap((i) =>
            i === activeItem
              ? [
                  ...activeItem.hidden,
                  {
                    kind: "show-less" as const,
                    toHide: activeItem.hidden,
                    indent: true,
                  },
                ]
              : [i],
          ),
        })),
      )
      return
    }

    if (key.return && activeItem.kind === "show-less") {
      setLocalSections((prev) =>
        prev.map((s) => ({
          ...s,
          items: s.items
            .filter((i) => !activeItem.toHide.includes(i as GHItem))
            .flatMap((i) =>
              i === activeItem
                ? [
                    {
                      kind: "show-more" as const,
                      hidden: activeItem.toHide,
                      indent: true,
                    },
                  ]
                : [i],
            ),
        })),
      )
      return
    }

    if (activeItem.kind === "show-more" || activeItem.kind === "show-less")
      return

    if (key.return) {
      // ↵ goes straight into the item's screen (PR / issue mount);
      // only items without a mounted view (task) fall back to the action menu.
      if (openDrillView(activeItem)) return
      // A row with no ticket behind it has nothing to drill into, so the menu
      // would hold open and copy and nothing else — one keystroke in front of
      // the only thing anyone pressed ↵ for.
      if (activeItem.kind === "task" && !activeItem.ticket) {
        void quietly`open ${activeItem.url}`.catch(() => {})
        showFlash("↗ Opened in browser")
        return
      }
      openMenu()
      return
    }

    // `m` is the only way into the action menu for a PR or an issue: ↵ mounts
    // their drill view above, so the close/jump/copy actions buildActions has
    // always returned were unreachable for exactly the two kinds that have the
    // most of them. Not Shift+↵ — terminals send a bare CR for it, so Ink
    // cannot tell the two apart without terminal-specific key protocols.
    if (input === "m") {
      openMenu()
      return
    }

    // Both of these must stay BELOW the search and repo-picker branches: those
    // return early to consume typed characters, and a letter bound above them
    // fires instead of reaching the search field. `e` was briefly bound next to
    // `?` and swallowed every "e" typed into a search.
    if (
      input === "e" &&
      activeItem &&
      (activeItem.kind === "pr" || activeItem.kind === "issue")
    ) {
      setExplain(true)
      return
    }

    if (input === "o") {
      // Opening a URL in the browser doesn't need the terminal, so stay in the
      // inbox — you can open several PRs without relaunching.
      quietly`open ${activeItem.url}`.catch(() => {})
      const label =
        activeItem.kind === "task" ? activeItem.key : `#${activeItem.number}`
      showFlash(`↗ Opened ${label}`)
      return
    }
    if (input === "c") {
      clipboard(activeItem.url)
      const label =
        activeItem.kind === "task" ? activeItem.key : `#${activeItem.number}`
      showFlash(`✓ Copied URL for ${label}`)
      return
    }
    if (input === "d") {
      if (openDrillView(activeItem)) return
      const cmd = drillCmd(activeItem)
      if (cmd) {
        void runInPane(cmd).catch(() => {})
        showFlash(`↗ ${drillLabel(activeItem)}`)
      }
      return
    }
    if (
      input === "u" &&
      (activeItem.kind === "pr" || activeItem.kind === "issue")
    ) {
      showFlash(`⋯ Unsubscribing from #${activeItem.number}…`)
      void unsubscribeFrom(activeItem)
        .then(() => showFlash(`✓ Unsubscribed from #${activeItem.number}`))
        .catch(() => showFlash(`✗ Unsubscribe failed for #${activeItem.number}`))
      return
    }
    // Mirrors the menu entry's guard exactly. A hint that renders on a row the
    // keymap will not act on is worse than no hint — it reads as a broken key.
    if (
      input === "x" &&
      activeItem.kind === "pr" &&
      activeItem.standing === "queued" &&
      login
    ) {
      removeItemFromSections(activeItem)
      showFlash(`⋯ Removing you from #${activeItem.number}…`)
      void quietly`gh pr edit ${activeItem.number} --repo ${activeItem.repo} --remove-reviewer ${login}`
        .then(() => {
          showFlash(`✓ Removed you as reviewer on #${activeItem.number}`)
          onActed?.()
        })
        .catch(() => {
          showFlash(`✗ Could not remove you from #${activeItem.number}`)
          onRefresh?.()
        })
      return
    }
    if (input === "b" && activeItem.kind === "pr" && activeItem.branch) {
      clipboard(activeItem.branch)
      showFlash(`✓ Copied ${activeItem.branch}`)
      return
    }
    if (activeItem.kind !== "task") {
      if (input === "s" && activeItem.kind === "pr" && activeItem.branch) {
        const script = [
          "delay 0.5",
          'tell application "iTerm2"',
          "  tell current session of current window",
          `    write text "git switch ${activeItem.branch}"`,
          "  end tell",
          "end tell",
        ].join("\n")
        const proc = spawn("osascript", ["-e", script], {
          detached: true,
          stdio: "ignore",
        })
        proc.unref()
        process.exit(0)
      }
      if (
        input === "j" &&
        (activeItem.kind === "pr" || activeItem.kind === "issue")
      ) {
        const { repo } = activeItem
        const branch = activeItem.kind === "pr" ? (activeItem.branch ?? "") : ""
        showFlash(`⋯ Opening ${repo}…`)
        void jumpToRepo(repo, branch, login)
          .then(() => showFlash(`↗ Opened ${repo} in new tab`))
          .catch(() => showFlash("✗ Jump failed"))
        return
      }
    }
    if (
      input === "t" &&
      activeItem &&
      activeItem.kind === "task" &&
      activeItem.ticket &&
      jiraTransitions &&
      jiraTransitions.length > 0
    ) {
      const jiraKey = activeItem.ticket
      const actions: Action[] = jiraTransitions.map(
        ({ label, transition, resolutions }) =>
          resolutions && resolutions.length > 0
            ? {
                label,
                hint: "",
                run: () => {},
                subActions: resolutions.map((resolution) => ({
                  label: resolution,
                  hint: "",
                  run: () => {
                    menu.close()
                    showFlash(`⋯ ${label} · ${resolution}…`)
                    quietly`jira issue move ${jiraKey} ${transition} --resolution ${resolution}`
                      .then(() => {
                        showFlash(`✓ ${label} · ${resolution}`)
                        onActed?.()
                      })
                      .catch(() => showFlash(`✗ Move to ${label} failed`))
                  },
                })),
              }
            : {
                label,
                hint: "",
                run: () => {
                  menu.close()
                  showFlash(`⋯ Moving to ${label}…`)
                  quietly`jira issue move ${jiraKey} ${transition}`
                    .then(() => {
                      showFlash(`✓ Moved to ${label}`)
                      onActed?.()
                    })
                    .catch(() => showFlash(`✗ Move to ${label} failed`))
                },
              },
      )
      menu.open(actions)
    }
  })

  const hints: [string, string][] = [
    ["↑↓", "nav"],
    ["←→", "tab"],
    ["↵/d", "open"],
    ["m", "actions"],
    ["?", "help"],
    ["q", "quit"],
  ]
  const matchCount = section.items.filter(
    (i) => i.kind !== "repo-header" && i.kind !== "subgroup-header",
  ).length

  if (hidden) return null

  // The four overlays are mutually exclusive and now FLOAT over the browse list
  // instead of replacing it, so pressing `?` no longer blanks the app to show its
  // own legend — the list stays put underneath, dimmed, the way a modal reads.
  const overlay = help ? (
    <HelpModal
      extensions={extensions}
      hasJira={!!jiraBase}
      tabHelp={tabHelp}
      maxRows={listHeight}
      scroll={helpScroll}
      onScrollRange={(max, page) => setHelpRange({ max, page })}
    />
  ) : explain &&
    activeItem &&
    (activeItem.kind === "pr" || activeItem.kind === "issue") ? (
    <ExplainModal item={activeItem} login={login} />
  ) : repoPicker ? (
    <RepoPicker
      repos={allRepos}
      selected={repoFilter}
      cursor={Math.min(repoCursor, Math.max(0, allRepos.length - 1))}
    />
  ) : menu.actions && activeItem && activeItem.kind !== "repo-header" ? (
    <ActionMenu item={activeItem} actions={menu.actions} cursor={menu.cursor} />
  ) : null

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor={FRAME_COLOR}
      borderDimColor
      paddingX={FRAME_PAD_X}
    >
      <InboxHeader
        brand={brand}
        sections={localSections}
        login={login}
        scopeLabel={origin?.label}
        refreshing={refreshing}
        hasPending={hasPending}
        pendingSummary={pendingSummary}
        fetchedAt={fetchedAt}
      />

      {ciStatusState ? (
        <CiStatusLine state={ciStatusState} job={ciJob} />
      ) : null}

      <Box marginBottom={1}>
        <Tabs
          active={section.id}
          items={localSections.map((s) => ({
            value: s.id,
            label: tabLabel(s.label, markedTabs, s.id),
            count: topLevelCount(s),
          }))}
        />
      </Box>

      {search != null ? (
        <Box marginBottom={1}>
          <Text color="cyan">{"  / "}</Text>
          <Text>{search}</Text>
          {searchInput ? <Text color="cyan">▏</Text> : null}
          <Text dimColor>{`   ${matchCount} match${
            matchCount !== 1 ? "es" : ""
          }${searchInput ? "  ↵ accept · esc clear" : "  esc clear"}`}</Text>
        </Box>
      ) : repoFilter.size > 0 ? (
        <Box marginBottom={1}>
          <Text color="#FF8700">{"  ◉ "}</Text>
          <Text>{`${repoFilter.size} repo${
            repoFilter.size !== 1 ? "s" : ""
          }`}</Text>
          <Text dimColor>{"   f edit · esc clear"}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" minHeight={listHeight}>
        <Backdrop dimmed={!!overlay} absolute={!!overlay} height={listHeight}>
          <Box flexDirection="column" flexGrow={1}>
            {visibleItems.map((item, i) => (
              <ItemRow
                // Prefix the absolute index so keys stay unique even when the
                // same repo header recurs down a time-sorted list (Done). The
                // sum viewStart + i is stable per underlying item across scroll.
                key={`${viewStart + i}:${
                  item.kind === "task"
                    ? (item.instanceKey ?? item.key)
                    : item.kind === "repo-header"
                      ? `header:${item.repo}`
                      : item.kind === "subgroup-header"
                        ? `subgroup:${item.label}`
                        : item.kind === "show-more"
                          ? `show-more:${item.hidden[0]?.repo ?? i}`
                          : item.kind === "show-less"
                            ? `show-less:${item.toHide[0]?.repo ?? i}`
                            : `${item.repo}/${item.number}`
                }`}
                item={item}
                active={viewStart + i === cursor}
                login={login}
                merged={
                  (item.kind === "pr" || item.kind === "issue") &&
                  !!mergedUrls?.includes(item.url)
                }
                transient={transientOf(transients, item)}
                // Computed against section.items, never the visible slice: a
                // window boundary is not the end of a group, and slicing first
                // would draw a closing corner wherever the scroll happens to cut.
                lastChild={
                  "indent" in item && item.indent
                    ? !isChildRow(section.items[viewStart + i + 1])
                    : undefined
                }
                parent={
                  item.kind === "task" &&
                  isChildRow(section.items[viewStart + i + 1])
                }
                sparkFrame={sparkFrame}
                gap={
                  // Window-relative, never `viewStart + i`. fitCount prices the
                  // window's FIRST row at one line (isFirst), so gapping it when
                  // scrolled draws a row the budget never bought — and the frame
                  // is sized to fill the terminal exactly, so the overflow scrolls
                  // the whole panel up a line instead of clipping.
                  i > 0 &&
                  (item.kind === "repo-header" ||
                    item.kind === "subgroup-header" ||
                    // A header is always followed by a blank line before its
                    // first child — in Other PRs that's "free" because the
                    // child is itself a repo-header (gap above). A task row
                    // has no such stand-in, so it needs this explicitly. Never
                    // applies between two tickets/PRs — only right after a
                    // header.
                    (item.kind === "task" &&
                      ["repo-header", "subgroup-header"].includes(
                        section.items[viewStart + i - 1]?.kind,
                      )))
                }
              />
            ))}
          </Box>
          {hasMore && (
            <Text dimColor>
              {"  "}↓ {section.items.length - viewStart - visibleCount} more
            </Text>
          )}
        </Backdrop>
        {overlay ? (
          <Box
            flexGrow={1}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            {overlay}
          </Box>
        ) : null}
      </Box>

      <Box marginTop={1}>
        {flash ? (
          <Text color="green">{flash}</Text>
        ) : (
          <FooterHints hints={hints} />
        )}
      </Box>
    </Box>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

// The body of the frame when the first fetch left nothing to browse. Both
// reasons render here rather than printing, and they SAY WHICH ONE — "nothing
// is open" and "the fetch died" are different answers, and a screen showing
// neither is indistinguishable from a third thing that also went wrong (a scope
// resolved somewhere you did not mean).
//
// It owns its own `useInput` because App cannot: App's hooks all sit above the
// early return that renders this, so a handler there would stay mounted under
// BrowseScreen and fight it for `q` and `r`.
const NoRowsScreen = ({
  reason,
  detail,
  onRetry,
}: {
  reason: "empty" | "failed"
  // What was actually looked at (empty) or what went wrong (failed). Optional on
  // the empty side because only the host knows how to describe its own scope.
  detail?: string
  onRetry: () => void
}) => {
  useInput((input) => {
    if (input === "q") process.exit(0)
    if (input === "r") onRetry()
  })
  return (
    <Box flexDirection="column">
      <StatusMessage variant={reason === "empty" ? "info" : "error"}>
        {reason === "empty"
          ? "Nothing open."
          : `Fetch failed — ${detail ?? "no reason reported"}`}
      </StatusMessage>
      {reason === "empty" && detail ? (
        <Box marginTop={1}>
          <Text dimColor>{detail}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <FooterHints
          hints={[
            ["r", "retry"],
            ["q", "quit"],
          ]}
        />
      </Box>
    </Box>
  )
}

type AppState =
  | { phase: "loading" }
  // The two ways a first fetch ends with no list to browse. They are states
  // rather than a console.log + process.exit because the host may be running us
  // under `alternateScreen: true`, where Ink restores the primary buffer on
  // teardown WITHOUT replaying anything written to the alternate one — so the
  // message was printed and then thrown away, leaving a screen that said
  // nothing at all. A rendered state is the only surface that survives, and it
  // is the right answer for a non-alternate host too.
  | { phase: "empty" }
  | { phase: "failed"; message: string }
  | { phase: "browse"; sections: Section[]; login: string }
  | { phase: "pr"; item: GHItem; sections: Section[]; login: string }
  | { phase: "issue"; item: GHItem; sections: Section[]; login: string }
  | {
      phase: "ext"
      extId: string
      target?: ExtensionTarget
      sections: Section[]
      login: string
    }

// `age` excluded: it's relative ("3d") and drifts each fetch, so it would flag
// "new" as PRs merely get older.
// Every RELATIVE time is stripped, not just `age`. These are strings like "5m"
// and "2d" rendered from a timestamp, so they drift on their own while nothing
// on GitHub moves — and a signature that counts them turns the clock into a
// change. `activityAge` was left in until 2026-08-27, which is why a cockpit
// left open kept lighting up "● new · r apply" over an inbox nobody had touched:
// a row that said 5m now said 6m, and that was the whole of it. `ts` stays in,
// deliberately — it is the underlying timestamp, and when THAT moves something
// really did happen.
const RELATIVE_TIME_KEYS = new Set(["age", "activityAge"])

export const signatureOf = (sections: Section[]): string =>
  JSON.stringify(sections, (k, v) =>
    RELATIVE_TIME_KEYS.has(k) ? undefined : v,
  )

export const App = ({
  fetcher,
  cacheKey,
  title = "inbox",
  detailFor,
  origin,
  jiraBase,
  jiraKeyRe,
  jiraTransitions,
  hasCiStatus,
  ciJob,
  ciFetcher,
  ciPollMs = 60_000,
  watchPath,
  watchDebounceMs = 400,
  extensions,
  tabHelp,
  emptyHint,
}: {
  fetcher: () => Promise<{
    sections: Section[]
    login: string
    ciStatus?: CiStatus | null
  }>
  cacheKey?: string
  // What this inbox is called, for the loading line. The shell is host-agnostic;
  // only the host knows whether it is a cockpit, a board, or something else.
  title?: string
  // The full-screen view for a drilled-into row. Host-supplied for the same
  // reason `extensions` is: the shell knows a row was opened, not what a PR or a
  // mission should look like once it is.
  detailFor?: (ctx: DetailContext) => React.ReactNode
  /** A two-way repo split, and what to call the side on screen. See OriginSplit. */
  origin?: OriginSplit
  // One-line meaning per tab, for the ? legend. Supplied by the host because the
  // tabs themselves are: one cockpit's are GitHub searches, another's are board
  // stages — and only the host knows which it built.
  tabHelp?: [string, string][]
  // One line naming what came back empty, shown under "Nothing open." Host-
  // supplied for the same reason `title` is: the shell knows the list is empty,
  // not which question it asked to get there — and on a scoped run that question
  // is exactly what the reader needs confirmed.
  emptyHint?: string
  jiraBase?: string
  jiraKeyRe?: RegExp
  jiraTransitions?: JiraTransition[]
  // Reserves a standing CI status row above everything else — loading until
  // the first fetch resolves, then ready/error — so callers that don't wire a
  // job (home's cockpit) see no row at all rather than one that never fills in.
  hasCiStatus?: boolean
  // Name of the job the row is glancing at — shown in the loading/error states,
  // where there's no fetched status to read it from.
  ciJob?: string
  // Optional independent poller for the CI line: the build result moves on its
  // own schedule (a pipeline can start/finish while you sit in the inbox), so
  // it refreshes on its own timer rather than waiting for a full inbox refresh.
  ciFetcher?: () => Promise<CiStatus | null>
  ciPollMs?: number
  /**
   * A file something else touches when it has changed GitHub on your behalf —
   * a Claude session closing an issue, a script merging a PR. Touching it makes
   * the inbox refetch; it never repaints on its own.
   */
  watchPath?: string
  /** Bursts of writes to collapse into one refetch. */
  watchDebounceMs?: number
  // Domain extensions the host can mount as full-screen overlays (their -ink
  // assembled bodies). Proven with Jenkins; the browse glances follow.
  extensions?: InboxExtension[]
}) => {
  const [state, setState] = useState<AppState>({ phase: "loading" })
  const [pending, setPending] = useState<{
    sections: Section[]
    login: string
  } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState<{
    message: string
    at: number
  } | null>(null)
  // Unlike sections (gated behind "r apply" so the list doesn't shift under
  // you mid-browse), CI status updates the moment a fresh fetch resolves —
  // it's a glance, not something you're navigating. Only updated on a
  // *successful* fetch (see revalidate) — a transient revalidate error leaves
  // the last-known status up rather than flashing to "unavailable".
  const [ciStatusState, setCiStatusState] = useState<CiStatusState>({
    kind: "loading",
  })
  // Apply a CI result without re-rendering when nothing meaningful changed —
  // returning the previous state reference makes React bail out, so a poll that
  // finds the same build (the common case) causes no repaint at all.
  const applyCiStatus = (status: CiStatus | null) =>
    setCiStatusState((prev) => {
      const next = toCiStatusState(status)
      return sameCiStatusState(prev, next) ? prev : next
    })
  // Serialised sections currently on screen — so "is fresh different?" compares
  // against what the user is looking at, not against the (already-stale) cache.
  const displayedKey = useRef<string>("")
  // The sections themselves, for the same reason one level finer: the key says
  // THAT the list moved, these say which rows did. A ref rather than reading
  // `state`, because showData is called from callbacks that closed over an
  // older render and would diff against a list nobody is looking at.
  const displayedSections = useRef<Section[]>([])
  const [transients, setTransients] =
    useState<Map<string, Transient>>(NO_TRANSIENTS)
  // Which tab each marked row sits in. A ref, not state: it is read inside the
  // hold's effect, which already reruns whenever the marks themselves change.
  const transitTabs = useRef<Map<string, string>>(new Map())
  // The tab the reader is actually looking at, reported up by BrowseScreen.
  const [visibleTab, setVisibleTab] = useState("")

  /* The one funnel where the displayed list changes, which makes it the one
     place that can say what changed. Applying used to swap one list for another
     and leave you to spot the difference against a frame the terminal had
     already scrolled away — the reason the manual gate felt like a cost rather
     than a control. */
  const showData = (sections: Section[], login: string) => {
    const before = displayedSections.current
    displayedSections.current = sections
    displayedKey.current = signatureOf(sections)
    setPending(null)
    setFetchedAt(Date.now())

    // First paint has nothing to have changed FROM. Every row is technically
    // new and flagging them all says nothing, so it opens quiet.
    if (before.length === 0) {
      transitTabs.current = new Map()
      setTransients(NO_TRANSIENTS)
      setState({ phase: "browse", sections, login })
      return
    }

    const { transients: fresh, union } = diffSections(before, sections)
    // Marks no tab has shown yet survive into this refresh. The hold is spent
    // per tab, so an unseen marker is a promise the cockpit has not kept —
    // dropping it here would make a second `r` the way to lose the news the
    // first one brought.
    const marks = new Map(fresh)
    for (const [key, mark] of transients)
      if (!marks.has(key)) marks.set(key, mark)
    // A carried-forward mark whose row is nowhere in the new union has no tab
    // left to settle it, and nothing on screen to attach to. Drop it.
    const tabs = tabsOfMarks(union, marks)
    for (const key of [...marks.keys()]) if (!tabs.has(key)) marks.delete(key)

    if (marks.size === 0) {
      transitTabs.current = new Map()
      setTransients(NO_TRANSIENTS)
      setState({ phase: "browse", sections, login })
      return
    }

    // Render the union — departing rows still standing where they were. Each
    // tab settles onto the real list on its own clock, once it has been seen.
    transitTabs.current = tabs
    setTransients(marks)
    setState({ phase: "browse", sections: union, login })
  }

  /* Spend one tab's hold and settle it.
     Only the departing rows separate the union from the real list, so settling
     is dropping them — not restoring the section wholesale, which would also
     undo any optimistic removal made during the hold. */
  const settleTab = (tabId: string, marks: Map<string, Transient>) => {
    const keys = [...transitTabs.current]
      .filter(([, tab]) => tab === tabId)
      .map(([key]) => key)
    for (const key of keys) transitTabs.current.delete(key)
    const gone = new Set(keys.filter((key) => marks.get(key) === "out"))
    setTransients((prev) => {
      const next = new Map(prev)
      for (const key of keys) next.delete(key)
      return next.size === 0 ? NO_TRANSIENTS : next
    })
    setState((prev) =>
      prev.phase !== "browse"
        ? prev
        : {
            ...prev,
            sections: prev.sections.map((section) =>
              section.id !== tabId
                ? section
                : {
                    ...section,
                    items: section.items.filter((item) => {
                      const key = keyOf(item)
                      return !(key && gone.has(key))
                    }),
                  },
            ),
          },
    )
  }

  /* The hold runs on the tab you are looking at, never on a global clock.
     A row that changed in another tab used to run out its 2.5s behind your
     back, so the refresh with news for you was the one that showed you nothing.
     Switching away cancels the timer rather than settling early — you get the
     full hold whenever you arrive, however long it took you to get there. */
  useEffect(() => {
    if (transients.size === 0) return
    // Behind a drill view there is no list to read the markers off.
    if (state.phase !== "browse" || !visibleTab) return
    if (![...transitTabs.current.values()].includes(visibleTab)) return
    const timer = setTimeout(
      () => settleTab(visibleTab, transients),
      TRANSIT_HOLD_MS,
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transients, visibleTab, state.phase])

  // What is waiting behind `r`, in words, so the indicator is worth its keypress.
  const pendingSummary = useMemo(
    () =>
      pending
        ? summariseDiff(
            diffSections(displayedSections.current, pending.sections).counts,
          )
        : "",
    [pending],
  )

  const revalidate = (manual = false) => {
    if (manual) setRefreshing(true)
    fetcher()
      .then((fresh) => {
        if (cacheKey) writeCache(cacheKey, fresh)
        setRefreshing(false)
        setFetchedAt(Date.now())
        setRefreshError(null)
        if (hasCiStatus) applyCiStatus(fresh.ciStatus ?? null)
        const freshKey = signatureOf(fresh.sections)
        if (!displayedKey.current) {
          if (fresh.sections.length === 0) {
            setState({ phase: "empty" })
            return
          }
          showData(fresh.sections, fresh.login)
        } else if (freshKey !== displayedKey.current) {
          // A changed signature is necessary but not sufficient. Belt and
          // braces for the class of bug `activityAge` was one instance of: if
          // the diff finds nothing entering, leaving or moving, then whatever
          // drifted is something the reader cannot see, and asking them to
          // press `r` to apply it spends attention on nothing. Swap silently
          // and keep the fresher data.
          const { counts } = diffSections(
            displayedSections.current,
            fresh.sections,
          )
          if (counts.added + counts.removed + counts.changed === 0)
            showData(fresh.sections, fresh.login)
          else setPending(fresh)
        } else {
          setPending(null)
        }
      })
      .catch((err) => {
        setRefreshing(false)
        const message = (err as Error).message
        // Nothing on screen yet, so there is no list to flash the error beside —
        // it becomes the whole screen instead. It must NOT be printed and exited:
        // see AppState, where the alternate buffer eats exactly that.
        if (!displayedKey.current) {
          setState({ phase: "failed", message })
          return
        }
        setRefreshError({ message, at: Date.now() })
      })
  }

  const applyOrRefresh = () => {
    if (pending) showData(pending.sections, pending.login)
    else revalidate(true)
  }

  /* Drop the cache the instant a mutation lands, then refresh once GitHub has
     had a moment to settle. The delay used to sit at each call site as a bare
     `setTimeout(…, 1500)`; the drop has to be synchronous and here, because the
     window between acting and refreshing is exactly when a quit would strand
     pre-action rows on disk. */
  const onActed = () => {
    if (cacheKey) invalidateCache(cacheKey)
    setTimeout(() => applyOrRefresh(), 1500)
  }

  useEffect(() => {
    const cached = cacheKey ? readCache(cacheKey) : null
    const painted = !!cached && cached.sections.length > 0
    if (painted && cached) {
      displayedKey.current = signatureOf(cached.sections)
      displayedSections.current = cached.sections
      setFetchedAt(cached.at)
      setState({
        phase: "browse",
        sections: cached.sections,
        login: cached.login,
      })
    }
    /* The whole point of the cache, and it was missing. This used to revalidate
       unconditionally, so the cached paint bought a fast first frame and saved
       nothing — 111 GraphQL points on every launch, however recently the last
       one ran. `r` still refetches on demand (`revalidate(true)`), and an action
       drops the entry outright, so nothing here can strand you on stale rows. */
    if (!painted || !isFresh(cached)) revalidate()
  }, [])

  // Poll the CI status on its own timer (independent of the gated inbox
  // refresh), applying each result immediately — it's a glance, not something
  // you navigate. A failed poll leaves the last-known status up rather than
  // flashing to "unavailable"; a null result (no build / not configured) is a
  // real "error" state. Only runs when a fetcher is wired and the row is shown.
  useEffect(() => {
    if (!hasCiStatus || !ciFetcher) return
    let live = true
    const poll = () => {
      ciFetcher()
        .then((status) => {
          if (!live) return
          applyCiStatus(status)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, ciPollMs)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [hasCiStatus, ciFetcher, ciPollMs])

  /* The signal path, and where it deliberately stops.
   *
   * A poller asks "has anything changed?" on a fixed beat and is wrong twice:
   * it burns quota on the long stretches where nothing has, and it is still up
   * to a full interval late when something does. A stamp file inverts it — the
   * thing that made the change says so, and this fires only then.
   *
   * It ends at `revalidate()`, NOT `onActed()`. The fetch is free to happen in
   * the background; the REPAINT is not, and stays behind `r`. A list that
   * reshuffles itself while you are reading it is the thing the manual gate
   * exists to prevent, and a signal that bypassed the gate would reintroduce
   * exactly that, just with better timing.
   *
   * Watch the DIRECTORY, not the file. A file that does not exist yet cannot be
   * watched at all, and an atomic write (write-temp-then-rename, which is what
   * anything careful does) replaces the inode — so a file watch goes deaf after
   * the first signal it receives, which is the worst available failure: it works
   * once, in testing, and never again.
   */
  useEffect(() => {
    if (!watchPath) return
    const dir = dirname(watchPath)
    const name = basename(watchPath)
    if (!existsSync(dir)) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let live = true
    let watcher: ReturnType<typeof watch>
    try {
      watcher = watch(dir, (_event, changed) => {
        if (!live || (changed && changed !== name)) return
        // Coalesce: one `touch` raises several events, and a burst of closed
        // issues should cost one fetch, not one each.
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => live && revalidate(), watchDebounceMs)
      })
    } catch {
      // An unwatchable directory costs the signal, never the inbox.
      return
    }
    return () => {
      live = false
      if (timer) clearTimeout(timer)
      watcher.close()
    }
  }, [watchPath, watchDebounceMs])

  // Merged rows live here rather than in BrowseScreen because the row has to
  // survive the trip back from the drill view, and BrowseScreen is remounted by
  // that navigation — state parked there would be gone before the first frame.
  const [mergedUrls, setMergedUrls] = useState<string[]>([])
  const mergeTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => mergeTimers.current.forEach(clearTimeout), [])

  // The three list-less states share the browse screen's frame so that whichever
  // one you land on, the header still says what was looked at — which under
  // `--here` is the scope itself, the thing a blank screen leaves you guessing.
  // The `w` indicator is dropped on the two settled ones: nothing there handles
  // the key, and a switch that does not switch is worse than no switch.
  if (
    state.phase === "loading" ||
    state.phase === "empty" ||
    state.phase === "failed"
  )
    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor={FRAME_COLOR}
        borderDimColor
        paddingX={FRAME_PAD_X}
      >
        <InboxHeader
          brand={brandOf(title)}
          sections={[]}
          login=""
          scopeLabel={state.phase === "loading" ? origin?.label : undefined}
          loading={state.phase === "loading"}
          quiet={state.phase !== "loading"}
        />
        {hasCiStatus ? (
          <CiStatusLine state={ciStatusState} job={ciJob} />
        ) : null}
        {state.phase === "loading" ? (
          <LoadingScreen label={`Fetching ${title}…`} />
        ) : (
          <NoRowsScreen
            reason={state.phase === "empty" ? "empty" : "failed"}
            detail={state.phase === "failed" ? state.message : emptyHint}
            onRetry={() => revalidate(true)}
          />
        )}
      </Box>
    )

  const overlay =
    state.phase === "pr"
      ? { kind: "pr" as const, item: state.item }
      : state.phase === "issue"
        ? { kind: "issue" as const, item: state.item }
        : state.phase === "ext"
          ? {
              kind: "ext" as const,
              extId: state.extId,
              target: state.target,
            }
          : null
  const toBrowse = () =>
    setState({ phase: "browse", sections: state.sections, login: state.login })

  // Closing from a drill hands back to the inbox, so the row has to be gone
  // from App's own sections — returning to a list that still shows what you
  // just closed is the lag the optimistic update exists to remove.
  const removeAndReturn = (target: GHItem) =>
    setState({
      phase: "browse",
      sections: withoutItem(state.sections, target),
      login: state.login,
    })

  // Back to the list first, so the sparkle happens where you can see it — the
  // drill view is still up at the moment the merge resolves, and a celebration
  // behind an overlay is no celebration.
  const markMerged = (target: GHItem) => {
    toBrowse()
    setMergedUrls((prev) =>
      prev.includes(target.url) ? prev : [...prev, target.url],
    )
    mergeTimers.current.push(
      setTimeout(() => {
        setMergedUrls((prev) => prev.filter((u) => u !== target.url))
        setState((s) =>
          s.phase === "browse"
            ? { ...s, sections: withoutItem(s.sections, target) }
            : s,
        )
      }, MERGED_HOLD_MS),
    )
  }
  return (
    <>
      <BrowseScreen
        brand={brandOf(title)}
        sections={state.sections}
        login={state.login}
        jiraBase={jiraBase}
        jiraKeyRe={jiraKeyRe}
        jiraTransitions={jiraTransitions}
        onRefresh={applyOrRefresh}
        onActed={onActed}
        refreshing={refreshing}
        hasPending={pending !== null}
        pendingSummary={pendingSummary}
        fetchedAt={fetchedAt}
        refreshError={refreshError ?? undefined}
        origin={origin}
        hidden={overlay !== null}
        mergedUrls={mergedUrls}
        transients={transients}
        onTabChange={setVisibleTab}
        ciStatusState={hasCiStatus ? ciStatusState : undefined}
        ciJob={ciJob}
        tabHelp={tabHelp}
        onOpenPr={(item) =>
          setState({
            phase: "pr",
            item,
            sections: state.sections,
            login: state.login,
          })
        }
        onOpenIssue={(item) =>
          setState({
            phase: "issue",
            item,
            sections: state.sections,
            login: state.login,
          })
        }
        onOpenExt={(id, target) =>
          setState({
            phase: "ext",
            extId: id,
            target,
            sections: state.sections,
            login: state.login,
          })
        }
        extensions={extensions}
      />
      {(overlay?.kind === "pr" || overlay?.kind === "issue") &&
        detailFor?.({
          item: overlay.item,
          kind: overlay.kind,
          login: state.login,
          onBack: toBrowse,
          onRefresh: applyOrRefresh,
          onRemove: removeAndReturn,
          onMerged: markMerged,
        })}
      {overlay?.kind === "ext" &&
        extensions
          ?.find((e) => e.id === overlay.extId)
          ?.body(toBrowse, overlay.target)}
    </>
  )
}
