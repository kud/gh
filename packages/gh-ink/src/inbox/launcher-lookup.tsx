import React, { useRef, useState, type ReactNode } from "react"
import { colors } from "@kud/ink-ui"
import { fetchItemNode, formatRef, parseRef } from "@kud/gh"
import { refCandidates, resolveRef } from "@kud/gh-workflow"
import type { AnyItem, GHItem, Section } from "@kud/gh-workflow"
import { Text } from "./backdrop.js"
import { LookupMiss, type InboxExtension } from "./extension.js"

// The launcher's lookup: a reference pasted into Ctrl+K becomes the item's
// drill, whether or not the inbox lists it.
//
// Its own file so the browse screen carries only the wiring — the memo asks
// `claimFor` what the query is and `lookupRows` what to draw for it, and the
// state machine below is the whole of what happens after Enter. Kept apart
// from the `/` row filter on purpose, and that boundary is the feature's one
// hard rule: the filter narrows what is already on screen and must never reach
// the network, so a lookup lives only behind the launcher's explicit Enter.

/**
 * What a query names, once something has recognised it: the words the rows
 * use for it, where the browser can show it, and the fetch Enter runs.
 */
export type Claim = {
  label: string
  browser?: { label: string; url: string }
  fetch: () => Promise<AnyItem>
}

export type ClaimContext = {
  /** The repo of the row under the cursor, tried first for a bare `#N`. */
  activeRepo?: string
  /** Every repo the inbox holds, tried next. */
  repos: readonly string[]
  sections: readonly Section[]
}

const isGH = (item: AnyItem): item is GHItem =>
  item.kind === "pr" || item.kind === "issue"

const listedAt = (
  sections: readonly Section[],
  repo: string,
  number: number,
): GHItem | undefined => {
  const want = repo.toLowerCase()
  for (const section of sections)
    for (const item of section.items)
      if (
        isGH(item) &&
        item.number === number &&
        item.repo.toLowerCase() === want
      )
        return item
  return undefined
}

/**
 * The row the inbox already holds for `item`, if it holds one.
 *
 * By repo and number for GitHub rows — case-insensitively, since GitHub names
 * are — and by kind and URL for anything an extension resolves, which is the
 * one identity every row kind carries. The listed copy wins because it is the
 * row the viewer returns to: its standing, its pin, its held state are all on
 * it, and a freshly fetched twin would drill without them.
 */
export const listedCopy = (
  sections: readonly Section[],
  item: AnyItem,
): AnyItem | undefined => {
  if (isGH(item)) return listedAt(sections, item.repo, item.number)
  const url = "url" in item ? item.url : undefined
  if (!url) return undefined
  for (const section of sections)
    for (const row of section.items)
      if (row.kind === item.kind && "url" in row && row.url === url) return row
  return undefined
}

/**
 * What opens: the listed copy when there is one, otherwise the fetched row —
 * marked `notInInbox` when it is GitHub's, so its drill can say the list will
 * not show it.
 */
export const settle = (sections: readonly Section[], item: AnyItem): AnyItem =>
  listedCopy(sections, item) ??
  (isGH(item) ? { ...item, notInInbox: true } : item)

/**
 * GitHub's own claim: a URL, `owner/repo#N`, or a bare `#N`.
 *
 * A listed copy is found BEFORE any fetch where the text alone can name it — a
 * full reference, or a bare `#N` the active row's repo holds — so the common
 * case of pasting something already on screen costs no round trip. A bare `#N`
 * that only a later repo lists is still fetched, because the active repo is
 * asked first and might hold a different `#N` the inbox does not; `settle`
 * then swaps in the listed copy of whatever it resolved to.
 *
 * The browser row needs a URL before anything is fetched. A pasted URL is its
 * own; a shorthand goes to `/issues/N`, which GitHub redirects to the PR when
 * that is what the number is; a bare `#N` borrows the first repo it would be
 * looked up in, and the row names that repo so the guess is visible.
 */
export const githubClaim = (
  query: string,
  { activeRepo, repos, sections }: ClaimContext,
): Claim | null => {
  const ref = parseRef(query)
  if (!ref) return null
  const near = ref.repo
    ? listedAt(sections, ref.repo, ref.number)
    : activeRepo
      ? listedAt(sections, activeRepo, ref.number)
      : undefined
  const label = near ? `${near.repo}#${near.number}` : formatRef(ref)
  const repo = ref.repo ?? refCandidates(activeRepo, repos)[0]
  const text = query.trim()
  const browserUrl =
    near?.url ??
    (/^https?:/i.test(text)
      ? text
      : repo
        ? `https://github.com/${repo}/issues/${ref.number}`
        : undefined)
  return {
    label,
    browser: browserUrl
      ? {
          label: near || !repo ? label : `${repo}#${ref.number}`,
          url: browserUrl,
        }
      : undefined,
    fetch: async () => {
      if (near) return near
      const item = await resolveRef(text, {
        fetchNode: (r, n) => fetchItemNode(r, n),
        activeRepo,
        repos,
      })
      if (!item) throw new LookupMiss(`nothing matches "${label}"`)
      return item
    },
  }
}

/**
 * Who claims the query: GitHub's resolver first, then each extension's
 * `resolve` in declaration order, the first non-null answer winning. GitHub
 * goes first so no extension can shadow a pasted PR — the same reason the
 * built-in rows come before any extension's `commands`.
 */
export const claimFor = (
  query: string,
  context: ClaimContext,
  extensions: readonly InboxExtension[] = [],
): Claim | null => {
  if (!query.trim()) return null
  const github = githubClaim(query, context)
  if (github) return github
  for (const ext of extensions) {
    const fetch = ext.resolve?.(query)
    if (fetch) return { label: query.trim(), fetch }
  }
  return null
}

export type Lookup =
  | { query: string; phase: "loading"; label: string }
  | {
      query: string
      phase: "missed" | "failed"
      label: string
      message: string
    }

// A failure's own words, short enough for one palette row. `gh` reports on
// stderr as `gh: <reason>`, and execa's own `message` opens with the whole
// command line — which here is a GraphQL document — so stderr is read first and
// the message only as a fallback.
const reasonOf = (error: unknown): string => {
  const e = error as { stderr?: unknown; message?: unknown }
  const text =
    (typeof e?.stderr === "string" && e.stderr.trim()) ||
    (typeof e?.message === "string" && e.message) ||
    String(error)
  const line = text.split("\n").find((l) => l.trim()) ?? text
  return line.replace(/^gh:\s*/, "").trim()
}

/**
 * The lookup's state machine: Enter starts it, the answer either opens the
 * item or lands as a row or message in the launcher — which stays open in
 * both cases, so a typo costs one keystroke and never a reopen.
 *
 * An answer is dropped unless it is still the newest lookup AND the launcher
 * still holds the query it was asked for. Typing past a slow lookup, or closing
 * the launcher under it, must not yank a drill open a second later; `reset`
 * runs on every keystroke for the same reason, and the query test is the
 * second lock for a path that skips it (esc).
 *
 * `open` is read through a ref, not the closure that started the lookup: it
 * reaches App's `onOpenPr`, which closes over App's sections, and a refresh
 * landing mid-lookup would otherwise drill on the list as it was before it.
 */
export const useLauncherLookup = (
  palette: string | null,
  open: (item: AnyItem) => boolean,
) => {
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const seq = useRef(0)
  const latest = useRef({ palette, open })
  latest.current = { palette, open }

  const start = (query: string, claim: Claim) => {
    const id = ++seq.current
    const live = () => id === seq.current && latest.current.palette === query
    setLookup({ query, phase: "loading", label: claim.label })
    claim.fetch().then(
      (item) => {
        if (!live()) return
        setLookup(null)
        if (!latest.current.open(item))
          setLookup({
            query,
            phase: "failed",
            label: claim.label,
            message: `nothing here can open ${claim.label}`,
          })
      },
      (error: unknown) => {
        if (!live()) return
        setLookup(
          error instanceof LookupMiss
            ? {
                query,
                phase: "missed",
                label: claim.label,
                message: error.message,
              }
            : {
                query,
                phase: "failed",
                label: claim.label,
                message: reasonOf(error),
              },
        )
      },
    )
  }

  const reset = () => {
    seq.current++
    setLookup(null)
  }

  return {
    lookup: lookup && lookup.query === palette ? lookup : null,
    start,
    reset,
  }
}

export type LookupRow = {
  id: string
  title: string
  label: ReactNode
  run: () => void
  /** Enter on it keeps the launcher open: the answer lands there. */
  keepOpen?: boolean
}

/**
 * The rows a claimed query draws, per lookup phase:
 *
 *   idle      `↵ opens acme/api-gateway#2926`, then open-in-browser
 *   loading   `Looking up acme/api-gateway#2926…`, alone
 *   missed    no row: `message` takes the launcher's message slot, muted
 *   failed    the reason, in the error tone; Enter asks again
 *
 * `exclusive` says the lookup owns the launcher, so nothing else is appended:
 * a Jira or extension row under a pending lookup would take an Enter meant for
 * the wait. The message slot only draws when there are no rows at all, which
 * is why `missed` is the one phase with none — and why a failure, which has to
 * be readable as a failure, is a row of its own: the slot has a single, muted
 * ink.
 */
export const lookupRows = (
  claim: Claim,
  lookup: Lookup | null,
  query: string,
  start: (query: string, claim: Claim) => void,
  openUrl: (url: string, label: string) => void,
): { rows: LookupRow[]; message?: string; exclusive: boolean } => {
  const ref = (s: string) => <Text color={colors.accent}>{s}</Text>
  if (lookup?.phase === "loading")
    return {
      exclusive: true,
      rows: [
        {
          id: "launcher:lookup",
          title: `Looking up ${claim.label}…`,
          label: <Text dimColor>Looking up {ref(claim.label)}…</Text>,
          run: () => {},
          keepOpen: true,
        },
      ],
    }
  if (lookup?.phase === "missed")
    return { exclusive: true, rows: [], message: lookup.message }
  if (lookup?.phase === "failed")
    return {
      exclusive: true,
      rows: [
        {
          id: "launcher:retry",
          title: `Couldn't look up ${claim.label}: ${lookup.message}`,
          label: (
            <Text color={colors.error}>
              ✗ couldn't look up {claim.label} · {lookup.message}
            </Text>
          ),
          run: () => start(query, claim),
          keepOpen: true,
        },
      ],
    }
  const rows: LookupRow[] = [
    {
      id: "launcher:open",
      title: `↵ opens ${claim.label}`,
      label: <Text>↵ opens {ref(claim.label)}</Text>,
      run: () => start(query, claim),
      keepOpen: true,
    },
  ]
  const browser = claim.browser
  if (browser)
    rows.push({
      id: "launcher:browser",
      title: `Open ${browser.label} in browser`,
      label: (
        <Text>
          Open {ref(browser.label)} <Text color={colors.info}>in browser</Text>
        </Text>
      ),
      run: () => openUrl(browser.url, browser.label),
    })
  return { exclusive: false, rows }
}
