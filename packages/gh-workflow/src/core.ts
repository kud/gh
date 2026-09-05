// Workflow semantics for a GitHub inbox: what a row is, whose move it is, how
// rows sort, group and filter. Lifted verbatim out of @kud/gh-ink so a browser
// surface can reach it — the logic was never terminal-specific, only its
// address was.

import type { Health } from "@kud/gh/health"
import { inboxConfig } from "./config.js"

/** Mirrors `@kud/ink-ui`'s `PillVariant`, structurally, so this package needs
 * no renderer dependency to say which fill a row's pill takes. */
export type PillVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "accent"
  | "muted"

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
  authored: [
    "ci-fail",
    "conflict",
    "changes-req",
    "threads",
    "approved",
    "draft",
  ],
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
  theySpokeLast?: boolean,
  pinned?: boolean,
): "you" | "them" => {
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
  // distinction the table below is built on — the mechanical blockers (ci-fail,
  // conflict, changes-req) are yours on your PR and theirs on theirs — so a
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

  return YOURS[position].includes(health) ? "you" : "them"
}

// Exported so the colourblind invariant can be tested against the health glyphs
// rather than restated as a literal in two files that drift apart.
export const PIN_MARK = "+"

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
  // Needed to read `lastActor`, which is only meaningful against somebody. Left
  // out, the bands fall back to health and standing alone — the behaviour every
  // caller had before, so an un-updated host degrades rather than breaks.
  login?: string,
): AnyItem[] => {
  if (sectionId === "done") return insertRepoHeaders(sortByRecency(items))

  const sorted = sortItems(items)
  const bands = (["you", "them"] as const).map((side) => ({
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

