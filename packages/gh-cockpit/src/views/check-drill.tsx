import type { ReactNode } from "react"

// How an activated CI check drills in.
//
// `PrView` used to import a Jenkins client and a Jenkins view directly, so a
// package that renders a GitHub PR could not be published without shipping one
// team's build server with it. Which CI systems a reader has is theirs to say —
// GitHub Actions is the only one a GitHub cockpit can assume, and even that is a
// drill it offers rather than one it requires.
//
// Registered viewers are tried in order; the first whose `match` accepts the
// check's URL renders it. Nothing matching means the check opens in a browser,
// which is the correct answer for a CI system this process knows nothing about.

export type CheckDrillContext = {
  /** `owner/name` of the PR the check belongs to. */
  repo: string
  /** The check's details URL, as GitHub reported it. */
  url: string
  /** Human label for the check, for the view's own chrome. */
  name: string
  /** Return focus to the PR view. */
  onBack: () => void
}

export type CheckDrill = {
  /** Whether this viewer handles the URL. Cheap and synchronous — it runs per activation. */
  match: (url: string) => boolean
  render: (ctx: CheckDrillContext) => ReactNode
}

let registered: readonly CheckDrill[] = []

/** Supply the host's CI drill-ins. Call once, before rendering. */
export const registerCheckDrills = (drills: readonly CheckDrill[]): void => {
  registered = drills
}

export const checkDrillFor = (url: string): CheckDrill | null =>
  registered.find((d) => d.match(url)) ?? null
