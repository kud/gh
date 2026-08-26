import type { ReactNode } from "react"
import type { InboxExtension, RepoFilter } from "@kud/gh-ink"
import type { CheckDrill } from "./views/check-drill.js"

/**
 * One tab. `searches` are GitHub search qualifiers, run as written and folded
 * into a single tab — which is how a tab can draw on more than one search while
 * still banding each row correctly.
 *
 * `standing` says where YOU stand on the rows a search returns, and it cannot be
 * recovered from a row afterwards: the same "awaiting review" is your work when
 * a review was requested of you and somebody else's once you have given one.
 * The two are different searches and nothing else tells them apart.
 */
export type TabSearch = {
  /** Search qualifiers, minus `is:pr` — e.g. `review-requested:@me`. */
  q: string
  standing?: "authored" | "queued" | "spoken"
}

export type TabSpec = {
  /** Shown on the tab, and in the `?` legend. Yours to word. */
  label: string
  /** One line saying what this tab holds, for the legend. */
  help?: string
  searches: readonly (string | TabSearch)[]
}

export type CockpitConfig = {
  tabs: readonly TabSpec[]
  /**
   * Repo ranking, best first. `acme/` matches an owner, `acme/monorepo` matches
   * one repo, so a repo can outrank the owner containing it.
   */
  repoPriority?: readonly string[]
  /** Default filter, which `--include` / `--exclude` override. */
  filter?: RepoFilter
  /** Named filters, invoked as `gh-cockpit <name>`. */
  filters?: Record<string, RepoFilter>
  /** Where checkouts live, for the drill-in that opens one. */
  checkoutDir?: string
  /** Cache directory name and how long a cached inbox is trusted. */
  cacheNamespace?: string
  cacheTtlMs?: number
  /** Where a CI check drills in. Nothing registered means checks open in a browser. */
  checkDrills?: readonly CheckDrill[]
  extensions?: readonly InboxExtension[]
  /** Rendered instead of the row's default drill-in, when supplied. */
  detailFor?: (ctx: never) => ReactNode
}

/**
 * Identity, but typed — so a config file is checked against the schema at build
 * time rather than producing an empty tab at runtime. The one thing a YAML
 * config could not have given us.
 */
export const defineCockpit = (config: CockpitConfig): CockpitConfig => config
