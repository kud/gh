// The cockpit's shared layer: everything a GitHub PR/issue surface needs that is
// not itself a view. Re-exports @kud/gh-ink wholesale so a consumer imports from
// one place, and adds the few things the library deliberately does not own — the
// GraphQL node → row mapping, health computation, and a transient-failure retry.
//
// Anything that knows about a specific machine, employer or CI system belongs to
// the HOST, not here: `configureInbox`, `registerCheckDrills` and the repo
// filters are how a host says those things.

/*
 * Every VALUE @kud/gh-ink exports, named one by one, and the list is not
 * boilerplate — it is the fix.
 *
 * This was `export * from "@kud/gh-ink"` for the package's whole life, and it
 * never worked once it was published. esbuild cannot express a star re-export of
 * an EXTERNAL package in ESM's static export list, so tsup degrades it to a
 * runtime __reExport shim that copies properties onto an internal object nothing
 * ever re-exports. The .d.ts keeps the star, so types resolve and tsc passes
 * clean: 0.2.2 shipped 17 of ~26 documented exports, with App, configureInbox,
 * layoutGHItems and whoseMove all `undefined` at runtime. A host got a green
 * typecheck and "Element type is invalid ... got: undefined" at first render.
 *
 * Inside the workspace the same star resolves from source and works perfectly,
 * which is what hid it — the bug only exists in the published artefact, and
 * every local check passed throughout. `exports.test.ts` beside this file now
 * imports the BUILT dist and compares against gh-ink's own key list, so the
 * next name to go missing fails a test rather than a render.
 *
 * TYPES stay a star below: type-only re-exports are erased before esbuild sees
 * them, so they never hit the degradation, and this way only the value names
 * need maintaining by hand.
 */
export {
  ActionMenu,
  App,
  budgetNotice,
  buildActions,
  buildCheckoutCmd,
  checkoutDirs,
  CiStatusLine,
  clipboard,
  COLS,
  CommentsPanel,
  configureInbox,
  drillCmd,
  explainGhAction,
  explainItem,
  filterByOrigin,
  filterByRepos,
  filterBySearch,
  fitCount,
  gapsAbove,
  healthColor,
  healthDisplay,
  healthGlyph,
  healthLegend,
  HealthPanel,
  inboxConfig,
  insertRepoHeaders,
  itermRun,
  jumpToRepo,
  jumpToRepoPane,
  labelPriority,
  layoutGHItems,
  matchesFilter,
  maxViewStart,
  moveCursor,
  openInTab,
  parsePatterns,
  PIN_MARK,
  profileOf,
  readCache,
  relativeTime,
  renderMarkdown,
  repoPriority,
  reposInSections,
  resetInboxConfig,
  resolveRepoPath,
  runHere,
  runInPane,
  runInPaneHorizontal,
  sameCiStatusState,
  signatureOf,
  sortByRecency,
  sortItems,
  SIDEBAR_COLS,
  SidePanel,
  counts,
  railCapacity,
  toCiStatusState,
  topLevelCount,
  truncate,
  useActionMenu,
  whoseMove,
  windowCount,
  withHeaders,
  withoutItem,
  writeCache,
} from "@kud/gh-ink"

export type * from "@kud/gh-ink"

// The GraphQL node → row mapping moved to @kud/gh-workflow. It never belonged
// beside signalPath(), which mkdirSync-es a cache directory — importing the
// mapper used to touch the filesystem.
import { toGHItem, type CockpitItem } from "@kud/gh-workflow"
export { toGHItem }
export type { CockpitItem }

import { $ } from "zx"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  inboxConfig,
  relativeTime,
  type GHDetail,
  type GHItem,
  type Section,
} from "@kud/gh-ink"
import {
  type Health,
  type InboxSource,
  buildInboxQueries,
  buildInboxQuery,
  mergeInboxData,
  computeHealth as ghComputeHealth,
  latestChecks,
  isPassCheck,
  isFailCheck,
  isPendingCheck,
} from "@kud/gh"

export { buildInboxQueries, buildInboxQuery, mergeInboxData }
export type { InboxSource }

export const withRetry = async <T,>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000,
): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = (err as Error).message ?? ""
      const isTransient = /50[234]/.test(msg)
      if (!isTransient || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw new Error("unreachable")
}

export const computeHealth = (node: any): Health =>
  ghComputeHealth({
    state: node.state,
    isDraft: "isDraft" in node ? node.isDraft : undefined,
    checks: node.statusCheckRollup?.contexts?.nodes ?? [],
    mergeable: node.mergeable,
    reviewDecision: node.reviewDecision,
    unresolvedThreads: ((node.reviewThreads?.nodes ?? []) as any[]).filter(
      (t) => t && !t.isResolved,
    ).length,
  })

// Every state has a distinct GLYPH — colour only reinforces, never distinguishes
// (kud is colourblind; two markers that share a shape and differ by colour are
// indistinguishable). So no two rows share a symbol.
// `none` is an issue: it has no review state, so it used to render a blank
// cell — an absence that read as missing data rather than as "this is an
// issue". nf-oct-issue_opened says it positively, in the column that was
// already reserved, which matters most in Assigned where PRs and issues mix.

// Who spoke last, across every surface an item can be spoken on: the
// conversation, a submitted review, and each thread's latest reply. Deliberately
// event-based rather than count-based — a count says a discussion happened, and
// the thing you actually need to know is whether the next move is yours.
// PENDING reviews are excluded: they're unsubmitted drafts nobody else can see.
//
// A push answers a machine, and does not answer a person. A review bot re-reads
// the diff on every push, so requiring words to clear its turn is a treadmill:
// you reply, you push, it reviews again, and the arrow is back. A person is owed
// words. So when a Bot holds the last word and a commit landed after it, the
// push IS the reply and the author is who spoke last. Bots stay fully visible —
// the row, the thread, the comment — they just stop claiming a turn you have
// already taken. Bot-ness comes from `__typename`, not the login: GraphQL
// reports app authors bare (`greptile-apps`), so a machine ACCOUNT such as
// `raycastbot` is a User here and still reads as human.
//
// That hatch assumes every turn is clearable by words or by a push, and one
// shape is clearable by neither: a bot commenting AFTER the last push — an
// autoplan fired by a change to the base branch, say — on a PR that is green,
// has no open thread and is simply waiting on somebody else's approval. It went
// to Your move and stayed there, with no action available that would clear it.
//
// So a third thing can settle a turn: 👀 from the viewer on the last comment. It
// reads as "no reply is owed for THIS one", and its scope is the point — it is a
// fact about one event, so the next comment is unacked and the turn comes back.
// That self-expiry is what makes it safe to reach for freely, and why it can
// never permanently silence a PR. Nothing about it is bot-specific; it is
// arguably more useful on a human's "non-blocking nit".
//
// The ack IS the reply, so it lands in the same hatch rather than beside it —
// handing back the author is already how this function says "no turn is owed",
// and `theySpokeLast` downstream is derived from `lastActor`.

export const signalPath = (): string => {
  const dir = join(
    process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
    inboxConfig().cacheNamespace,
  )
  mkdirSync(dir, { recursive: true })
  return join(dir, "cockpit-dirty")
}
