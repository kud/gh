import React, { useState } from "react"
import { useInput, useWindowSize } from "ink"
import { colors, ScrollView, TextInput, type StyledLine } from "@kud/ink-ui"
import {
  resolveThread,
  unresolveThread,
  replyToThread,
  type PrComments,
  type ReviewThread,
  type Comment,
} from "@kud/gh"
import { relativeTime } from "@kud/gh-workflow"
import { renderMarkdown } from "../lib/markdown.js"

type FileLink = (path: string, line?: number) => string

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(n, hi))

// How long ago a comment was written, as the inbox prints an age (`3d`).
// Empty when the comment carries no timestamp or an unparseable one: a missing
// age is better than `NaNw`.
const commentAge = (createdAt?: string): string =>
  createdAt && !Number.isNaN(Date.parse(createdAt))
    ? relativeTime(createdAt)
    : ""

export const commentLines = (
  { author, body, createdAt }: Comment,
  width: number,
  fileLink: FileLink,
  indent = 0,
): StyledLine[] => {
  const pad = " ".repeat(indent)
  // Frame each comment with a `── author 3d ──────` rule — the same grouping
  // vibe as the glance's repo dividers — so comments are scannable, not a wall.
  // A blank under the rule as well as over it: a body that opens with a
  // heading or a bold line sat flush against the rule and read as part of it.
  //
  // The author is bold and uncoloured. It was drawn in the accent until
  // 2026-11-22, and so was the PR title and the selected thread — on a long
  // review a dozen orange names competed with the one orange thing that meant
  // "you are here". The accent is spent on the cursor alone now, and the age
  // beside the name says what the colour never did: how stale the remark is.
  const age = commentAge(createdAt)
  const fill = Math.max(
    3,
    width - indent - author.length - (age ? age.length + 1 : 0) - 4,
  )
  const lines: StyledLine[] = [
    {
      text: "",
      spans: [
        { text: pad + "── ", dim: true },
        { text: author, bold: true },
        ...(age ? [{ text: " " + age, color: colors.muted }] : []),
        { text: " " + "─".repeat(fill), dim: true },
      ],
    },
    { text: "" },
  ]
  const bodyLines = renderMarkdown(body, width - indent, fileLink)
  if (bodyLines.length === 0) lines.push({ text: pad + "(empty)", dim: true })
  else
    for (const l of bodyLines)
      lines.push(
        l.spans
          ? { ...l, spans: [{ text: pad }, ...l.spans] }
          : { ...l, text: pad + l.text },
      )
  lines.push({ text: "" })
  return lines
}

export type CommentsPanelProps = {
  repo: string
  number: number
  data: PrComments | null
  error: string | null
  reload: () => void
  onReplyingChange?: (active: boolean) => void
  // Off when the host already names the section — cockpit puts the payload
  // behind a "Conversation" tab, so the panel's own heading stacked the same
  // word twice. The "Review threads" heading is unaffected: it separates two
  // genuinely different lists, which no host label replaces.
  showConversationHeading?: boolean
}

// Content-only comments panel (the consuming surface owns any chrome and the
// fetch — passing the loaded data in so it can also show counts). Read view of
// the conversation + a *selectable* list of review threads: ↑↓ moves the thread
// cursor, `x` toggles resolve, `r` opens an inline reply, `R` unfolds and
// refolds the resolved and outdated threads. Mutations run on @kud/gh and call `reload` to refetch.
// `onReplyingChange` lets the host suspend its own shortcuts while the reply
// field is focused.
export const CommentsPanel = ({
  repo,
  number,
  data,
  error,
  reload,
  onReplyingChange,
  showConversationHeading = true,
}: CommentsPanelProps) => {
  // Settled threads start folded to one line each rather than hidden or shown
  // in full. Shown in full they buried the open ones — on a long review the
  // thread you still owed a reply to sat under screens of conversations that
  // were already over. Hidden, they could not be found or unresolved without a
  // keystroke you had to know about. Folded, each one still says where it was
  // and still takes the cursor, so `x` can reopen it from where it sits.
  const [showResolved, setShowResolved] = useState(false)
  const [threadSel, setThreadSel] = useState(0)
  const [replying, setReplying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const { columns } = useWindowSize()
  const width = Math.max(20, columns - 2)

  const setReply = (v: boolean) => {
    setReplying(v)
    onReplyingChange?.(v)
  }

  const fileLink: FileLink = (path, line) =>
    `https://github.com/${repo}/blob/${data?.headRef ?? "HEAD"}/${path}` +
    (line ? `#L${line}` : "")

  const conversation = data?.conversation ?? []
  const threads = data?.threads ?? []
  const isSettled = (t: ReviewThread) => t.isResolved || t.isOutdated
  const folded = showResolved ? 0 : threads.filter(isSettled).length
  const sel = clamp(threadSel, 0, Math.max(0, threads.length - 1))
  const selThread: ReviewThread | null = threads[sel] ?? null

  const doResolveToggle = async () => {
    if (!selThread) return
    const resolving = !selThread.isResolved
    setStatus(resolving ? "Resolving…" : "Unresolving…")
    try {
      if (resolving) await resolveThread(selThread.id)
      else await unresolveThread(selThread.id)
      setStatus(null)
      reload()
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`)
    }
  }

  const submitReply = async (body: string) => {
    setReply(false)
    const trimmed = body.trim()
    if (!selThread || !trimmed) return
    const root = selThread.comments[0]
    if (!root?.databaseId) {
      setStatus("Nothing to reply to on this thread")
      return
    }
    setStatus("Replying…")
    try {
      await replyToThread({
        repo,
        pull: number,
        inReplyTo: root.databaseId,
        body: trimmed,
      })
      setStatus(null)
      reload()
    } catch (e) {
      setStatus(`Reply failed: ${(e as Error).message}`)
    }
  }

  // Cancel a reply with Esc; while replying this is the only live handler here
  // (the nav handler below is inert) and the TextInput owns typing + submit.
  useInput(
    (_input, key) => {
      if (key.escape) setReply(false)
    },
    { isActive: replying },
  )

  useInput(
    (input, key) => {
      if (input === "R") return setShowResolved((s) => !s)
      if (!threads.length) return
      if (key.upArrow || input === "k")
        setThreadSel(() => clamp(sel - 1, 0, threads.length - 1))
      else if (key.downArrow || input === "j")
        setThreadSel(() => clamp(sel + 1, 0, threads.length - 1))
      else if (input === "x") void doResolveToggle()
      else if (input === "r" && selThread) setReply(true)
    },
    { isActive: !replying },
  )

  const lines: StyledLine[] = []
  let anchor = 0 // first line of the selected thread → drives the scroll offset

  if (error) lines.push({ text: `Error: ${error}`, color: colors.error })
  else if (!data) lines.push({ text: "Fetching comments…", color: colors.info })
  else {
    if (status)
      lines.push(
        { text: status, color: colors.warning, bold: true },
        { text: "" },
      )

    if (conversation.length === 0 && threads.length === 0)
      lines.push({ text: "Nothing has been said on it yet.", dim: true })

    // Headings are bold and uncoloured, their counts muted: a heading names a
    // region, and the info blue it used to carry made it read as a link.
    const heading = (title: string, count: number): StyledLine => ({
      text: "",
      spans: [
        { text: title, bold: true },
        { text: ` ${count}`, color: colors.muted },
      ],
    })

    if (conversation.length > 0) {
      if (showConversationHeading) {
        lines.push(heading("Conversation", conversation.length))
        lines.push({ text: "" })
      }
      for (const c of conversation)
        lines.push(...commentLines(c, width, fileLink))
    }

    if (threads.length > 0) {
      lines.push(heading("Review threads", threads.length))
      lines.push({ text: "" })
      threads.forEach((t, i) => {
        if (i === sel) anchor = lines.length
        const active = i === sel
        const fold = !showResolved && isSettled(t)
        const loc = (t.path ?? "conversation") + (t.line ? `:${t.line}` : "")
        const tags =
          (t.isResolved ? " resolved" : "") + (t.isOutdated ? " outdated" : "")
        const replies = t.comments.length
        lines.push({
          text: "",
          spans: [
            { text: active ? "❯ " : "  ", color: colors.accent, bold: true },
            {
              text: loc,
              ...(active
                ? { color: colors.accent, bold: true }
                : fold
                  ? { dim: true }
                  : {}),
            },
            ...(tags ? [{ text: " ·" + tags, color: colors.muted }] : []),
            ...(fold
              ? [
                  {
                    text: ` · ${replies} ${replies === 1 ? "comment" : "comments"}`,
                    color: colors.muted,
                  },
                ]
              : []),
          ],
        })
        if (!fold)
          for (const c of t.comments)
            lines.push(...commentLines(c, width, fileLink, 2))
      })
      if (folded > 0) lines.push({ text: "" })
    }

    if (folded > 0)
      lines.push({
        text: `${folded} resolved/outdated folded — R to unfold`,
        dim: true,
      })
  }

  return (
    <>
      <ScrollView lines={lines} initialStart={anchor} isActive={!replying} />
      {replying ? (
        <TextInput
          placeholder={`Reply to ${selThread?.path ?? "thread"}… (↵ send · esc cancel)`}
          onSubmit={submitReply}
        />
      ) : null}
    </>
  )
}
