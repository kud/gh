import type { ReactNode } from "react"
// Type-only, so the cycle with inbox.tsx (which imports InboxExtension from here)
// is erased at compile time and never exists at runtime.
import type { AnyItem } from "./inbox.js"

// The context the browse screen hands an extension body when its key is pressed.
// Every field is optional because it describes what happened to be in view, not a
// contract the extension can demand.
//
// This was a bare `string` — the Jenkins job name — which is why nothing but
// Jenkins could be an extension. A row-scoped extension (delegate the selected
// PR/issue to an agent) needs the ROW, and no string carries one. Both contexts
// travel together rather than being switched on the extension's id, because the
// moment the host inspects an id to decide what to send, `key` is decorative
// again and the next extension is another arm in the host.
export type ExtensionTarget = {
  // The selected row, when one was selected. Absent on a header row, or when the
  // active tab is empty. Typed as AnyItem, so a row-scoped body narrows on `kind`
  // rather than assuming it got a PR.
  item?: AnyItem
  // The job named on the CI glance row, when the host renders one.
  ciJob?: string
  // The authenticated login. Always known by the time the browse screen renders,
  // and it has to arrive this way: extensions are declared at module scope, before
  // the viewer has been fetched, so a body cannot close over it.
  login: string
}

// An inbox extension — a domain's contribution to the host. `body` is the full
// detail screen, mounted as an overlay when its `key` is pressed on the browse
// screen; it's the domain's @kud/<domain>-ink assembled body (e.g. <JenkinsBody>),
// i.e. the same view the domain's own CLI mounts. `glance` (the dashboard summary
// row) will join this interface when the browse screen is lifted behind it — for
// now Jenkins proves the `body` seam. See the kud-tool-ecosystem architecture.
//
// `key` is matched against the pressed key generically, AFTER the browse screen's
// own bindings — so an extension cannot shadow navigation, refresh or quit, and a
// key already taken (q r w f / J) simply never reaches it.
export interface InboxExtension {
  id: string
  // Spelled out, for the `?` legend: "Jenkins explorer", not "jenkins".
  title: string
  key: string
  // Short label for the footer strip, where columns are scarce. Falls back to a
  // lowercased `title`, which is what the footer showed for Jenkins before any of
  // this was derived — the two surfaces genuinely want different lengths.
  hint?: string
  // Whether the extension acts on the SELECTED ROW or on the host as a whole.
  // Only `item` extensions earn a place in a row's action menu: Jenkins is not
  // something you do to a pull request, and listing it under `m` beside "Close PR"
  // would read as if it were. Both kinds appear in the footer and the legend,
  // because both are things you can press.
  scope?: "item" | "global"
  // `target` is the optional context the opener passes — the body decides what to
  // do with it, and ignores the parts it has no use for.
  body: (onExit: () => void, target?: ExtensionTarget) => ReactNode
}
