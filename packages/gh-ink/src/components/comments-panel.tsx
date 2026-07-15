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
import { renderMarkdown } from "../lib/markdown.js"

type FileLink = (path: string, line?: number) => string

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(n, hi))

const commentLines = (
  { author, body }: Comment,
  width: number,
  fileLink: FileLink,
  indent = 0,
): StyledLine[] => {
  const pad = " ".repeat(indent)
  // Frame each comment with a `── author ──────` rule — the same grouping vibe
  // as the glance's repo dividers — so comments are scannable, not a wall.
  const fill = Math.max(3, width - indent - author.length - 4)
  const lines: StyledLine[] = [
    {
      text: "",
      spans: [
        { text: pad + "── ", dim: true },
        { text: author, color: colors.accent, bold: true },
        { text: " " + "─".repeat(fill), dim: true },
      ],
    },
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
}

// Content-only comments panel (the consuming surface owns any chrome and the
// fetch — passing the loaded data in so it can also show counts). Read view of
// the conversation + a *selectable* list of review threads: ↑↓ moves the thread
// cursor, `x` toggles resolve, `r` opens an inline reply, `R` shows/hides
// resolved. Mutations run on @kud/gh and call `reload` to refetch.
// `onReplyingChange` lets the host suspend its own shortcuts while the reply
// field is focused.
export const CommentsPanel = ({
  repo,
  number,
  data,
  error,
  reload,
  onReplyingChange,
}: CommentsPanelProps) => {
  const [showResolved, setShowResolved] = useState(true)
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
  const allThreads = data?.threads ?? []
  const threads = showResolved
    ? allThreads
    : allThreads.filter((t) => !t.isResolved && !t.isOutdated)
  const hiddenThreads = allThreads.length - threads.length
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

    if (conversation.length === 0 && allThreads.length === 0)
      lines.push({ text: "No comments on this PR.", dim: true })

    if (conversation.length > 0) {
      lines.push({
        text: `Conversation (${conversation.length})`,
        color: colors.info,
        bold: true,
      })
      lines.push({ text: "" })
      for (const c of conversation)
        lines.push(...commentLines(c, width, fileLink))
    }

    if (threads.length > 0) {
      lines.push({
        text: `Review threads (${threads.length})`,
        color: colors.info,
        bold: true,
      })
      lines.push({ text: "" })
      threads.forEach((t, i) => {
        if (i === sel) anchor = lines.length
        const active = i === sel
        const loc = (t.path ?? "conversation") + (t.line ? `:${t.line}` : "")
        const tags =
          (t.isResolved ? " [resolved]" : "") +
          (t.isOutdated ? " [outdated]" : "")
        lines.push({
          text: "",
          spans: [
            { text: active ? "❯ " : "  ", color: colors.info, bold: true },
            {
              text: loc,
              color: active ? colors.accent : colors.muted,
              bold: active,
            },
            ...(tags ? [{ text: tags, dim: true }] : []),
          ],
        })
        for (const c of t.comments)
          lines.push(...commentLines(c, width, fileLink, 2))
      })
    }

    if (hiddenThreads > 0)
      lines.push({
        text: `${hiddenThreads} resolved/outdated hidden — R to show`,
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
