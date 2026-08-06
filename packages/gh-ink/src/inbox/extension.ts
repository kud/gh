import type { ReactNode } from "react"

// An inbox extension — a domain's contribution to the host. `body` is the full
// detail screen, mounted as an overlay when its `key` is pressed on the browse
// screen; it's the domain's @kud/<domain>-ink assembled body (e.g. <JenkinsBody>),
// i.e. the same view the domain's own CLI mounts. `glance` (the dashboard summary
// row) will join this interface when the browse screen is lifted behind it — for
// now Jenkins proves the `body` seam. See the kud-tool-ecosystem architecture.
export interface InboxExtension {
  id: string
  title: string
  key: string
  // `target` is an optional context the opener passes (e.g. a Jenkins job to
  // focus on) — the body decides what to do with it.
  body: (onExit: () => void, target?: string) => ReactNode
}
