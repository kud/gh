// Workflow semantics for a GitHub inbox: what a row is, whose move it is, how
// rows sort, group and filter. Lifted verbatim out of @kud/gh-ink so a browser
// surface can reach it — the logic was never terminal-specific, only its
// address was.

import type { Health } from "@kud/gh/health"
import { inboxConfig } from "./config.js"

/**
 * Mirrors `@kud/ink-ui`'s `PillVariant`, structurally, so this package needs
 * no renderer dependency to say which fill a row's pill takes.
 *
 * A mirror drifts in exactly one direction: ink-ui grows a variant and this
 * list does not, and the failure lands on a HOST, not here — a board typing its
 * pill from ink-ui cannot assign the row, though every package in this repo
 * still typechecks. `group` arrived in ink-ui 0.25.0 for an epic holding the
 * rows beneath it, and the changeset that adopted it said this list had
 * followed. It had not. Extend this the same commit ink-ui's pin moves.
 */
export type PillVariant =
  "success" | "error" | "warning" | "info" | "accent" | "muted" | "group"

export type GHDetail = {
  reviewDecision?: string
  mergeable?: string
  checksPass: number
  checksFail: number
  checksPending: number
  // Terminal checks that reached no verdict — cancelled or abandoned. Optional
  // because it arrived after the other three: a host that does not set it keeps
  // working and simply says nothing about them, rather than reporting zero as
  // though it had looked.
  checksStale?: number
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
  /**
   * The PR's aggregate health, when the fetch paid for it.
   *
   * Optional for the same reason `labels` below is: a `minimal` fetch omits the
   * whole selection, and those fields vanish rather than degrade. The direction
   * matters here more than anywhere else on the row — `computeHealth`'s ladder
   * falls THROUGH an absent `reviewDecision`, `mergeable` and check rollup to
   * `waiting`, so a row nobody looked at reports "awaiting review" with the same
   * confidence as one that was read. Undefined means not asked for, and
   * `whoseMove` answers `unknown` for it rather than guessing.
   *
   * `merged`, `closed`, `draft` and `none` are exempt: each is readable off
   * `state` or `isDraft`, which the minimal shape keeps, so those tokens are
   * honest at any fetch depth.
   */
  health?: Health
  author?: string
  /**
   * How big the diff is — lines added, lines removed, files touched — so a list
   * can say `+18 -4` beside a title and the reader can decide whether to open
   * it at all. Read them through `sizeOf` / `filesOf`, which are the only
   * places that decide how they read.
   *
   * Three flat fields rather than a `size` object, and the same names as
   * `PrHealthData` carries: a `Pick<…, "additions" | "deletions">` then accepts
   * a row and a health payload structurally, which is what lets one formatter
   * serve the list and the detail view. Optional because they are absent from
   * any section cached before the query selected them, and from any node built
   * by hand; the row draws no cell when they are missing rather than claiming
   * zero.
   */
  additions?: number
  deletions?: number
  changedFiles?: number
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
  /**
   * The item's labels, unordered and by name only — which is all GitHub gives
   * without the timeline API. `labels(first: N)` orders by when the label was
   * created IN THE REPO, never by when it was applied here, so "the newest two"
   * is not derivable and the row ranks them against the host's `labelPriority`
   * instead.
   *
   * Optional because a `minimal` fetch omits the selection entirely — these
   * fields vanish rather than degrade — so undefined means "not asked for",
   * which the row draws as nothing at all rather than as an unlabelled item.
   */
  labels?: readonly string[]
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
  /**
   * A turn the viewer has claimed BY HAND, outranking everything inferred.
   *
   * The inference below is good and still gets things wrong in one direction it
   * cannot see: a row can be genuinely yours while every signal says otherwise —
   * nothing red, no unresolved thread, nobody waiting on a word from you — and
   * no amount of reading the PR harder will discover it. That knowledge lives
   * with the viewer, so this is the field where they put it.
   *
   * It is a PIN, not a correction: it applies whether or not the row was already
   * yours, which is why it does not pair with an opposite. The other direction —
   * "no reply is owed for this particular comment" — is a fact about one event
   * and belongs where the events are read, not here; a host expresses it by
   * handing back a `lastActor` that no longer claims a turn.
   */
  pinned?: boolean
  /**
   * What this row STANDS FOR, when that differs from what it is. Absent means
   * the row is a unit of work and is counted as one.
   *
   * `"container"` marks a row that exists to carry context rather than to be
   * done: the initiative a story hangs under, drawn as a real row because it is
   * still selectable, openable, and worth seeing until it closes — but not
   * itself a thing on anyone's plate. Four stories under one container is four
   * items, not five.
   *
   * Deliberately not `uncounted`. A host knows what a row IS; it should not have
   * to know what the tab badge does with that, and a field named after one
   * consumer starts lying the moment a second one reads it.
   *
   * Orthogonal to `depth`, which says where the row hangs rather than what it
   * stands for. A container is a genuine depth-0 row with genuine depth-1
   * children; spelling it as a depth would mean lying about the tree to fix a
   * number, and every site that draws indentation reads that lie as truth.
   *
   * A union with one member rather than a boolean. `indent` was a boolean that
   * turned out to need a scalar, and widening it cost a deprecation that is
   * still in this file. Adding a second role here is additive; turning a boolean
   * into a union is not.
   */
  role?: "container"
  /**
   * How deep this row hangs in the tree: 0 top level, 1 a child, 2 a
   * grandchild. Absent means 0.
   *
   * Always read it through `depthOf`, never off the row — `indent` is still a
   * legal way to spell "depth 1", and that helper is the only place that knows
   * both spellings. A site that reads `item.indent` directly prices a `depth: 2`
   * row as top level, which is the bug this field exists to end rather than a
   * new one to introduce.
   */
  depth?: number
  /**
   * @deprecated Legacy spelling of `depth: 1`. Write `depth`; this is kept so
   * every existing producer still typechecks, and it is read in exactly one
   * place (`depthOf`). Due to be removed at the next major.
   */
  indent?: boolean
}

export type TaskRow = {
  kind: "task"
  key: string
  summary: string
  url: string
  status: string
  age: string
  /** What this row stands for. See `GHItem.role`. */
  role?: "container"
  /** How deep this row hangs. See `GHItem.depth`; read it through `depthOf`. */
  depth?: number
  /** @deprecated Legacy spelling of `depth: 1`. See `GHItem.indent`. */
  indent?: boolean
  instanceKey?: string
  /**
   * Trailing annotation, rendered dim after the summary — a recurrence marker,
   * a source hint, anything secondary to the title. Its own node rather than
   * part of `summary` so it can be dimmed, and so its width is measured
   * separately instead of being smuggled past the truncation maths.
   */
  note?: string
  /**
   * A category this row BELONGS to — `epic`, `blocked`, `spike` — drawn as a
   * filled pill after the summary.
   *
   * Deliberately not a second spelling of `note`, which the epic marker used to
   * borrow. The two want opposite weights: a pill says the word itself is the
   * information, while `note` is for a reference the reader follows — a parent
   * ticket key, a source. Filling a breadcrumb gives it a weight it has not
   * earned, and a row can legitimately carry both (a story under someone else's
   * epic shows its parent's key AND, one day, a status of its own).
   */
  pill?: string
  /** Which fill the pill takes. See `@kud/ink-ui`'s `PillVariant`. */
  pillVariant?: PillVariant
  /**
   * An explicit fill for the pill, overriding `pillVariant` — the same escape
   * hatch `@kud/ink-ui`'s `Pill` exposes, carried up to the row so a host can
   * use it without reaching past this type.
   *
   * For a state the external system INVENTED and the reader already knows by
   * its hue: GitHub's merged purple, a CI provider's result colours. Never
   * for that system's skin — Jira paints its issue types, but a type is a
   * classification, and a classification takes a `pillVariant` chosen by
   * meaning. The test is whether the hue names something that HAPPENED in the
   * source system, or merely decorates a category the tokens can already say.
   *
   * The word stays the primary channel either way — `Pill` draws the label
   * whatever the fill, so a reader who cannot separate the hues loses nothing.
   */
  pillColor?: string
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
  /** How deep this row hangs. See `GHItem.depth`; read it through `depthOf`. */
  depth?: number
  /** @deprecated Legacy spelling of `depth: 1`. See `GHItem.indent`. */
  indent?: boolean
}

export type ShowMore = {
  kind: "show-more"
  hidden: GHItem[]
  /** How deep this row hangs. See `GHItem.depth`; read it through `depthOf`. */
  depth?: number
  /** @deprecated Legacy spelling of `depth: 1`. See `GHItem.indent`. */
  indent?: boolean
}

export type ShowLess = {
  kind: "show-less"
  toHide: GHItem[]
  /** How deep this row hangs. See `GHItem.depth`; read it through `depthOf`. */
  depth?: number
  /** @deprecated Legacy spelling of `depth: 1`. See `GHItem.indent`. */
  indent?: boolean
}

export type SubgroupHeader = {
  kind: "subgroup-header"
  label: string
  age: string
  /** How deep this row hangs. See `GHItem.depth`; read it through `depthOf`. */
  depth?: number
  /** @deprecated Legacy spelling of `depth: 1`. See `GHItem.indent`. */
  indent?: boolean
}

export type AnyItem =
  GHItem | TaskRow | RepoHeader | SubgroupHeader | ShowMore | ShowLess

/**
 * The one place either spelling of depth is read. Every other site goes through
 * this, so a row written as `depth: 2` cannot be priced as top level by a
 * reader that only knew about the boolean.
 *
 * Clamped and floored rather than trusted: a bad producer degrades to a flatter
 * list, where the old behaviour was a `NaN` column width that renders as a
 * blank row and gives you nothing to diagnose from.
 */
export const depthOf = (item?: AnyItem): number => {
  if (!item) return 0
  if (typeof item.depth === "number") return Math.max(0, Math.floor(item.depth))
  return item.indent === true ? 1 : 0
}

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
  /**
   * Present when `items` is a SAMPLE of a larger set rather than the set —
   * because a source behind it matched more rows than its query was allowed to
   * return. `total` is how many there really are.
   *
   * It exists for the DIFF before it exists for the display. A surface that
   * marks arrivals and departures by comparing two fetches is asking what
   * changed in the world and reading the answer off a fixed-size window; where
   * the window is smaller than the world those are different questions, and any
   * update to any row reorders the window, evicts one, and gets the eviction
   * reported as news about a row that never moved.
   *
   * Measured 2026-09-07: `authoredIssues` matched 95 and returned 30,
   * `repoIssues` 94 and 30, `assigned` 37 and 30. Three sources inventing
   * arrivals and departures all day, which is what made the board flicker.
   *
   * Absent means whole. A host that cannot tell must leave it unset rather than
   * guess: an invented sample silences real news, which is the worse failure of
   * the two.
   */
  sampled?: { total: number }
}

// Everything a host needs to render a drilled-into row. `kind` is narrowed so a
// host can branch without re-testing item.kind.

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const relativeTime = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return `${Math.floor(diff / 604800)}w`
}

/**
 * A line count as the row prints it. Whole past four digits: a 12,345-line PR
 * has stopped being a number anyone weighs, and `12k` says "not this
 * afternoon" in three columns where `12345` spends five saying the same. No
 * decimal, for the same reason — `12.3k` is precision nobody triages on.
 * Below that the digits are kept exact, because `+412` and `+4120` are the
 * difference between a review and a day.
 */
const compactLines = (n: number): string =>
  n >= 10_000 ? `${Math.round(n / 1000)}k` : String(n)

/**
 * The size string, `+412 -38`, identical on every surface that draws one.
 *
 * `+` always before `-`, never reordered by magnitude, so position is a second
 * channel beside the sign: a colourblind reader who cannot tell the two numbers
 * apart by hue still knows which is which by where it sits. Surfaces that colour
 * the pair take it through `sizePartsOf` and paint each half sign-and-digits
 * together, so the coloured form is this string split at the space and can
 * never say anything the plain one does not. ASCII hyphen rather
 * than U+2212 — this codebase holds a single-column invariant on glyphs, `−`
 * is ambiguous-width in some fonts, and `git diff --stat` uses the hyphen
 * anyway. `null`, not `+0 -0`, when the fetch has not answered: a PR of no
 * lines and a PR nobody measured are different claims.
 *
 * Here, beside `relativeTime`, because it is a surface-agnostic formatter over
 * a row's facts, and the list and the PR header both draw it. A second copy in
 * either would drift the first time one grew a rule the other lacked.
 */
export const sizePartsOf = (
  data: Pick<GHItem, "additions" | "deletions">,
): { added: string; removed: string } | null =>
  data.additions === undefined || data.deletions === undefined
    ? null
    : {
        added: `+${compactLines(data.additions)}`,
        removed: `-${compactLines(data.deletions)}`,
      }

export const sizeOf = (
  data: Pick<GHItem, "additions" | "deletions">,
): string | null => {
  const parts = sizePartsOf(data)
  return parts ? `${parts.added} ${parts.removed}` : null
}

/** `3 files`, `1 file`, or `null` while unmeasured — same rule as `sizeOf`. */
export const filesOf = (data: Pick<GHItem, "changedFiles">): string | null =>
  data.changedFiles === undefined
    ? null
    : `${data.changedFiles} ${data.changedFiles === 1 ? "file" : "files"}`

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

// The same idea for labels, with two deliberate differences. An entry ending in
// `*` matches by prefix — `app:*` covers every per-app label without listing
// them — where the repo form uses a trailing `/`, because `/` is a real
// separator in a repo name and `*` is not a character a label may contain.
//
// And unmatched labels rank Infinity rather than `order.length`, so they all
// share one rank and the localeCompare tiebreak orders them among themselves.
// With `order.length` an unmatched label would tie with nothing below it and the
// distinction would be invisible — same behaviour today, but it stops being the
// same the moment a rank is compared against anything other than another rank.
export const labelPriority = (name: string): number => {
  const order = inboxConfig().labelPriority
  const i = order.findIndex((p) =>
    p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p,
  )
  return i === -1 ? Infinity : i
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
    if (depthOf(item) === 0 && item.repo !== lastRepo) {
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
// point: a verdict against the branch (ci-fail, changes-req) is yours only on
// your own PR, and the queue states (waiting, pending) only while a review is
// still wanted from you. `threads` alone is yours from all three — it is
// literally "your reply is owed", and it is the only thing left on a PR you have
// already reviewed.
//
// `conflict` sat with the verdicts until 2026-09-09 and does not any more. The
// line it moved across is the one `isFailCheck` already draws in `@kud/gh`'s
// health.ts: whether a judgement was ever reached about the code. A failing
// check is a verdict — something was examined and found wanting, and the diff
// you were asked to read is about to change. CONFLICTING is not a verdict:
// nothing was examined, nobody decided anything, and the usual cause is a third
// party merging something else while this PR sat still. The diff survives the
// rebase, so reviewing it is not wasted work — and "reviewing it is wasted" is
// the entire claim the `queued` column makes when it declines a row.
//
// It costs more than one token, because `computeHealth` ranks `conflict` SECOND,
// above changes-req and threads. A conflicted PR carrying an open thread
// addressed to you never surfaces as `threads` at all — the ladder collapses it
// on the way past — so the row you were owed a reply on was filed under Their
// move for a reason that had nothing to do with the reply.
//
// `ci-fail` deliberately did not move with it. On 2026-08-26 the Review tab held
// 20 rows of which 18 were red builds, conflicts and drafts, and reading a red
// build as the author's is what made that tab usable at all. That is an
// observation rather than a principle, and it is the half of the original
// reading nothing has since contradicted.
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
// `none` stays unlisted here, and that is not the same as unclaimed. This table
// maps a review state onto a standing, and an issue has no review state to map;
// `whoseMove` claims it for `authored` one branch earlier, off the fact that
// `none` identifies an issue rather than merely failing to identify anything.
// Listing it here instead would have claimed it from `queued` and `spoken` too,
// where somebody else's issue is not yours for having been pointed at it.
const YOURS: Record<Standing, Health[]> = {
  authored: [
    "ci-fail",
    "conflict",
    "changes-req",
    "threads",
    "approved",
    "draft",
  ],
  queued: ["waiting", "pending", "threads", "approved", "conflict"],
  spoken: ["threads"],
}

/**
 * Whose move it is, or an honest refusal to say.
 *
 * Three answers rather than two, and the third is the whole point. Every row
 * used to resolve to `you` or `them`, which meant a row that could not answer
 * still got one — `YOURS[position].includes(health)` with an absent health is
 * `includes(undefined)`, which is false, so it silently became `them`.
 *
 * That failed twice, both times in the direction that looks like nothing is
 * wrong. Every issue carries `none` (an issue has no review state to read), so
 * 44 rows matching `assignee:@me` filed under Their move while the column that
 * counts them read `0`. And the two-tier fetch a truncated source needs — a
 * cheap `minimal` fragment for the rows past the cap, see `@kud/gh`'s `limits`
 * — would have filed 79 overflow rows the same way, on the exact column that
 * had been reported missing, reproducing the complaint while appearing to fix
 * it.
 *
 * `unknown` is not a shade of `them`. A row carrying it is present, selectable
 * and openable, with its title, repo, age and links intact; the one thing it
 * declines is a verdict it was never given the facts for.
 */
export type Move = "you" | "them" | "unknown"

// The row's own standing wins where the host set one; the tab decides otherwise,
// and an unrecognised tab reads as `queued` — over-claiming a stranger's PR as
// your work is the worse wrong guess.
//
// `health` is optional because a `minimal` fetch omits the whole health
// selection — the same reason `GHItem.labels` is optional, and the same
// direction of failure to avoid: those fields vanish rather than degrade, so
// absent health is not health `waiting`.
export const whoseMove = (
  health: Health | undefined,
  sectionId: string,
  standing?: Standing,
  theySpokeLast?: boolean,
  pinned?: boolean,
): Move => {
  const position = standing ?? STANDING[sectionId] ?? "queued"

  // First, and unconditionally. Everything below is inference from what GitHub
  // reports; this is the viewer having said so outright, and inference does not
  // get to argue with it. It is one-directional by design — there is no way to
  // pin a row AWAY, because "not mine" is what the bands already conclude on
  // their own and a second control for it would only be a way to hide work.
  if (pinned) return "you"

  // Somebody else having the last word is a claim on you — a question asked, an
  // objection raised, a "can you rebase" — and none of it shows up as a health,
  // because a bare comment approves nothing, fails nothing and opens no thread.
  // The row already said so and the band disagreed: the turn arrow reads
  // lastActor and drew `←`, the explain panel spelled out "X spoke last, your
  // reply is owed", and the band filed it under Their move.
  //
  // ON YOUR OWN PR ONLY, though. Read unconditionally it destroys the very
  // distinction the table below is built on — a verdict against the branch
  // (ci-fail, changes-req) is yours on your PR and theirs on theirs — so a
  // stranger's failing build became your move the moment they commented on it.
  // Shipped that way for one release on 2026-08-27; eleven rows of somebody
  // else's work turned up under Your move, which is exactly the noise the bands
  // exist to prevent.
  //
  // The other two positions need no help from it: a review actually wanted from
  // you is `waiting`/`pending`, and a conversation you are in is `threads`, both
  // already listed. What is deliberately NOT claimed is a plain reply on a PR
  // you reviewed once — real, but indistinguishable from the author saying
  // "rebased" to nobody in particular.
  //
  // One direction only, even here: YOU having spoken last does not hand the row
  // over, since red CI on your own PR is yours whether or not you commented
  // after it.
  if (theySpokeLast && position === "authored") return "you"

  // BELOW the two claims above, deliberately. Both of them read something the
  // row actually carries — a reaction the viewer left, a login that is not
  // theirs — and neither needs the health selection to be true. A row with no
  // health can still have been pinned, and somebody can still have spoken last
  // on your own issue; declining a verdict there would throw away a fact we
  // hold in order to report one we do not.
  //
  // `none` used to join that absent case wholesale, which was right about never
  // reaching `them` and too broad about everything else — the narrowing is the
  // claim immediately below.
  //
  // `none` is not an absent verdict. It is a POSITIVE identification: an open
  // row that never had an `isDraft` to read, which is to say an issue. From
  // `authored` — your own tab, your assignment — that is a reading rather than
  // a guess, and it is the only reading available: an open issue you filed or
  // were assigned is nobody else's to advance. No review is outstanding, no
  // check can go red, and there is no third party in the room to hand it to.
  //
  // Declining here was the honest answer only while `unknown` covered two
  // different absences with one token. It cost a whole tab: a repo-scoped
  // Assigned tab is issues end to end, so every row landed in a band whose own
  // justification is that its label carries information, above a header that
  // could only ever read `Unclassified (n)`.
  //
  // `undefined` must NOT join this, and that is the entire reason the two are
  // separated rather than tested together as they were before. `undefined` is a
  // `minimal` fetch with the health selection omitted, where the row may well
  // be a PR — claiming it from `authored` would be precisely the confident
  // wrong answer `healthOf` refuses to give.
  //
  // The other two standings keep declining, for the reason the band exists. An
  // issue reached from `queued` or `spoken` is somebody else's thread you were
  // pointed at or replied to once, and having commented is not ownership.
  if (health === "none" && position === "authored") return "you"

  if (health === undefined || health === "none") return "unknown"

  return YOURS[position].includes(health) ? "you" : "them"
}

// Exported so the colourblind invariant can be tested against the health glyphs
// rather than restated as a literal in two files that drift apart.
export const PIN_MARK = "+"

// `Unclassified` breaks the possessive pattern the other two share, and that is
// the point rather than an oversight. "Your move" and "Their move" are two
// positions on one axis — ownership — so a third phrase of the same shape
// ("Move unknown") lands on that axis and reads as a third owner, which is
// precisely the misreading this band exists to prevent. The grammatical break IS
// the signal that this band answers a different question.
//
// Not "No verdict" or "Not yet read" either: both promise a verdict is coming,
// which is false for an issue that simply has no review state. And not
// "Unknown", which reads as a null — 79 things broken rather than 79 things
// deliberately not claimed.
const BAND_LABEL: Record<Move, string> = {
  you: "Your move",
  unknown: "Unclassified",
  them: "Their move",
}

// Lay out a section's GH items. The Done tab is a flat newest-first list; every
// other tab splits into two whose-move bands, each keeping its own repo grouping
// so the outer key stays legible inside a band. Repo headers are inserted in
// every case, and restart per band — a repo with work on both sides of the line
// appears under each.
//
// A single-sided tab still gets its one header. The label is the information —
// eight rows under "Their move" says nothing is owed by you, which is the
// answer the tab was opened to get, and an unlabelled list says it only to
// somebody who already knows how the bands work. The empty side is still
// omitted: a "(0)" header names a band with nothing in it.
export const layoutGHItems = (
  items: GHItem[],
  sectionId: string,
  // Needed to read `lastActor`, which is only meaningful against somebody. Left
  // out, the bands fall back to health and standing alone — the behaviour every
  // caller had before, so an un-updated host degrades rather than breaks.
  login?: string,
): AnyItem[] => {
  if (sectionId === "done") return insertRepoHeaders(sortByRecency(items))

  const sorted = sortItems(items)
  // `unknown` sits BETWEEN the two, not after them. The bands rank claims on the
  // reader's attention rather than confidence in the reading, and `them` is the
  // one band that exists to be skipped — so a row we could not rule out outranks
  // one we ruled out.
  //
  // Sorting it last would have left these rows exactly where
  // `includes(undefined)` already had them, at the bottom under Their move,
  // where 44 assigned issues sat while the column counting them read 0. Same
  // burial, now with a type to make it look deliberate.
  //
  // Order within each band is untouched — sortItems still groups by repo
  // priority and sinks drafts. The band says what is known about a row; how rows
  // rank among themselves is a separate claim and re-ranking here would smuggle
  // it in.
  const bands = (["you", "unknown", "them"] as const).map((side) => ({
    side,
    rows: sorted.filter(
      (i) =>
        whoseMove(
          i.health,
          sectionId,
          i.standing,
          !!login && !!i.lastActor && i.lastActor !== login,
          i.pinned,
        ) === side,
    ),
  }))
  const filled = bands.filter((b) => b.rows.length > 0)

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
