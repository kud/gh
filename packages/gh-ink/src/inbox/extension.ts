import { createContext, useContext, useEffect, type ReactNode } from "react"
// Type-only, so the cycle with inbox.tsx (which imports InboxExtension from here)
// is erased at compile time and never exists at runtime.
import type { AnyItem } from "./inbox.js"

// ─── Persistent chrome ──────────────────────────────────────────────────────
//
// The inbox frame, its title row and its footer stay on screen while an overlay
// (an extension body or a drill-in view) is open, and the overlay renders in
// the content area between them. An overlay that wants a word in either says
// so through `useChrome`: the header breadcrumb (which item this is) and the
// footer's hints. One that never calls it still renders inside the frame, with
// the shell's own back/quit tail — `body(onExit, target)` keeps its signature,
// so silence is never a blank screen.
//
// A setter, not a value: the overlay sets, the shell reads. Set on mount (and
// whenever scope/hints change, so a tab switch can swap the footer's verbs) and
// deliberately NOT cleared on unmount — every chrome-setting view sets on
// mount, and the shell clears on its own transitions (open/close), so a swap
// between two chrome-setting views (a drill and its own log) can never land on
// a blank in between whatever order React runs the two effects in.
export type ChromeHints = [string, string][]
export type ChromeSpec = { scope?: string; hints?: ChromeHints }

export type ChromeState = ChromeSpec & {
  setChrome: (spec: ChromeSpec) => void
}

// Null outside the inbox shell — a view mounted standalone (a domain CLI, a
// unit test) gets no provider, and `useChrome` below is a no-op there rather
// than a crash. Not part of the public index: the shell reads it, views only
// ever call `useChrome`.
export const InboxChromeContext = createContext<ChromeState | null>(null)

/**
 * Claim a word in the inbox chrome while mounted: `scope` becomes the header
 * breadcrumb (e.g. `Resubmit · acme/api-gateway#1234`), `hints` the footer's
 * verbs. The shell appends its own back/quit tail, so a body passes only its
 * own keys — never `esc`, `q` or `?`.
 *
 * Returns whether a shell claimed it: a view mounted outside the inbox (where
 * the context is null) draws its own chrome instead, so the same component
 * renders framed standalone and chromeless inside the shell.
 */
export const useChrome = (spec: ChromeSpec): boolean => {
  const chrome = useContext(InboxChromeContext)
  const setChrome = chrome?.setChrome
  const scope = spec.scope
  // The hints travel as their serialisation, not their identity: a body builds
  // the array inline, so the reference is new on every render while the verbs
  // are the same — and an effect keyed on the reference would set state on
  // every render, which re-renders, which sets again.
  const hintsKey = JSON.stringify(spec.hints ?? null)
  useEffect(() => {
    if (!setChrome) return
    setChrome({ scope, hints: spec.hints })
    // `spec.hints` read directly: `hintsKey` above is what dedupes renders,
    // and what is set is the body's own array for the shell to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setChrome, scope, hintsKey])
  return chrome !== null
}

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
  // Drop the row from the list, now. The built-in verbs have had this all along
  // — `x` removes you as reviewer and the row goes at once, before the network
  // call it started has answered — but an extension could not touch the list at
  // all, so a row-scoped one had no way to show that anything had happened. A
  // host that hides rows by its own rule (a mute list, a snooze) would write its
  // state, exit, and leave the row sitting there until the next refetch was
  // applied, which reads exactly like the keypress having failed.
  //
  // Local to the view, like every other use of it: it does not re-run the query,
  // and a refetch brings the row back unless the host's own rule now excludes it.
  onRemove?: (item: AnyItem) => void
  // The one-line status message under the frame. Same channel the built-in verbs
  // use, so an extension's feedback reads as part of the app rather than as
  // something a screen printed on its way out.
  showFlash?: (msg: string) => void
  // What the launcher holds, when an extension is being asked for commands
  // rather than a body. `query` is the text as typed; `ticketKey` is that text
  // once the host has matched it against its own `jiraKeyRe` and normalised it.
  // Handed down rather than re-derived so there is one regex site — an
  // extension that parsed `query` itself would be the second rule for one key,
  // and the two would disagree the first time the host's pattern moved.
  query?: string
  ticketKey?: string
}

// One row of the launcher, contributed by an extension. `run` is what Enter
// does; the host closes the palette first, so a body that mounts something can
// assume the list is the top layer again.
export type Command = {
  id: string
  title: string
  group?: string
  run: () => void | Promise<void>
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
  // Which menu group an item extension's row belongs to: `"act"` for verbs that
  // act on the row (Submit, Land, Delegate), `"open"` for verbs that open
  // something (Open ticket). Absent or `"other"` lands with the quiet verbs at
  // the menu's end (Mute). The menu capitalises `hint` for the row's label, so
  // `hint` is the same lowercase verb phrase the footer shows.
  menuGroup?: "act" | "open" | "other"
  // The row's glyph in nerd-font terminals, as a `"\uF4FA"` escape — never a raw
  // byte, which is invisible in review. Shown only when ink-ui's `getIconMode()`
  // is `"nerd"`; in text mode the icon column is dropped entirely, so nothing
  // here may carry meaning the label does not already say. A host picks its own
  // value; the ones the built-ins use are listed in the README's icon table so
  // sibling verbs can match them.
  icon?: string
  // Row kinds this extension is THE in-tree view for. Declaring `["task"]` makes
  // ↵ (and `d`, and the menu's drill action) on a ticket row mount this body the
  // way ↵ on a PR mounts PrView — instead of opening the action menu or spawning
  // a pane. A kind gets one such extension; the first declared wins.
  //
  // A declaration rather than a new `onOpenTask` seam beside `onOpenPr`, because
  // the shell already knows more about Jira than it should and a third
  // hard-wired notion would be one more arm to keep in step. The extension seam
  // is the generic door; this field says which rows walk through it on ↵. Hosts
  // that declare nothing keep exactly the old behaviour, pane fallback included.
  drills?: AnyItem["kind"][]
  // `target` is the optional context the opener passes — the body decides what to
  // do with it, and ignores the parts it has no use for.
  body: (onExit: () => void, target?: ExtensionTarget) => ReactNode
  // Rows this extension adds to the launcher (Ctrl+K) for the current target.
  // Called on every keystroke, so it must be sync and pure — anything that
  // resolves config does so once at extension init, not in here. The host
  // draws its own rows first (open here, open in Jira) and appends these, so an
  // extension can only add verbs, never reorder the built-ins. Returning `[]`
  // adds nothing and draws nothing: an extension's silence is never a row.
  commands?: (target: ExtensionTarget) => Command[]
  // A thing this extension can open BY NAME from the launcher — a ticket key, a
  // build number — when the viewer pastes it and it is not a row on screen.
  //
  // Two halves, because the launcher needs one answer per keystroke and one
  // round trip per Enter. The outer call is the recognition: sync and pure, the
  // same rules as `commands`, and `null` means "not mine". What it returns is the
  // fetch, which runs only when the viewer presses Enter on the row it earns.
  // The thunk resolves to the row to open, which goes through the same drill a
  // listed row of that kind takes; it rejects with `LookupMiss` for "nothing by
  // that name" (drawn muted, as the launcher's no-match line) and with anything
  // else for a failure (drawn in the error tone). The input stays open either
  // way, so a typo costs a keystroke rather than a reopen.
  //
  // GitHub references are the host's own resolver and are asked FIRST, then each
  // extension in declaration order; the first non-null answer claims the input.
  // So an extension cannot shadow `acme/api-gateway#2926`, and two extensions
  // claiming one shape resolve the way their keys already do — first declared
  // wins. If the resolved row is already in the inbox, the listed copy opens
  // instead, so the drill sees the row the list will come back to.
  resolve?: (input: string) => (() => Promise<AnyItem>) | null
}

/**
 * How a `resolve` thunk says "nothing by that name": the launcher draws its
 * message muted, the way it draws a query that matched nothing, and keeps the
 * input open. Any other rejection is a failure and is drawn in the error tone —
 * the difference a reader needs between "you typed it wrong" and "try again".
 */
export class LookupMiss extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LookupMiss"
  }
}
