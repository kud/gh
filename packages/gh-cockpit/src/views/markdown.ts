import { colors } from "@kud/ink-ui"
import type { StyledLine, Span } from "@kud/ink-ui"

// Render GitHub-flavoured markdown (with the raw HTML that bots love to embed)
// into styled terminal lines — the glow/lazygit look, not flat stripped text.
// Not a real parser: a pragmatic renderer that keeps structure (headings, code,
// quotes, lists) as line-level colour/weight, since bot comments dump <table>,
// <h3>, <details> straight into the body and left raw they corrupt the TUI.

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&bull;": "•",
  "&rarr;": "→",
  "&larr;": "←",
  "&check;": "✓",
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? "")

// Turn block-level HTML into newlines / bullets / cell separators before the
// blanket tag strip, so structure survives as whitespace instead of vanishing.
const htmlToText = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|ul|ol|table|thead|tbody|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(td|th)>/gi, " · ")
    .replace(/<(td|th)[^>]*>/gi, "")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[img: $1]")
    .replace(/<img[^>]*>/gi, "[img]")
    .replace(/<[^>]+>/g, "")

const stripInline = (line: string): string =>
  line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "[img: $1]")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")

const wrap = (text: string, width: number): string[] => {
  if (width <= 0) return [text]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const word of words) {
    if (word.length > width) {
      if (cur) {
        lines.push(cur)
        cur = ""
      }
      let rest = word
      while (rest.length > width) {
        lines.push(rest.slice(0, width))
        rest = rest.slice(width)
      }
      cur = rest
      continue
    }
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= width) cur += " " + word
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [""]
}

const CODE_COLOR = "#8FBCBB"

// Links → "text (url)" / images → "[img: alt]" as plain text, before inline
// emphasis parsing (so a link's text can't be mistaken for markup).
const linkify = (s: string): string =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "[img: $1]")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")

// **bold** · `code` · *italic* — underscores are deliberately NOT treated as
// emphasis to avoid mangling snake_case identifiers (get_flag_url).
const INLINE_RE = /(\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*)/g

const parseInline = (text: string): Span[] => {
  const spans: Span[] = []
  const re = new RegExp(INLINE_RE)
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) })
    if (m[2] != null) spans.push({ text: m[2], bold: true })
    else if (m[3] != null) spans.push({ text: m[3], color: CODE_COLOR })
    else if (m[4] != null) spans.push({ text: m[4], italic: true })
    last = re.lastIndex
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans
}

const sameStyle = (a: Span, b: Span): boolean =>
  a.color === b.color &&
  a.bold === b.bold &&
  a.dim === b.dim &&
  a.italic === b.italic

// Word-wrap a run of styled spans into lines of spans, merging adjacent words
// of the same style so each line is a compact list of runs.
const wrapSpans = (spans: Span[], width: number): Span[][] => {
  const words: Span[] = []
  for (const s of spans)
    for (const w of s.text.split(/\s+/).filter(Boolean))
      words.push({ text: w, color: s.color, bold: s.bold, italic: s.italic })

  const lines: Span[][] = []
  let cur: Span[] = []
  const curLen = () => cur.reduce((n, sp) => n + sp.text.length, 0)
  for (const w of words) {
    const sep = cur.length ? 1 : 0
    if (cur.length && curLen() + sep + w.text.length > width) {
      lines.push(cur)
      cur = []
    }
    const prefix = cur.length ? " " : ""
    const last = cur[cur.length - 1]
    if (last && sameStyle(last, w)) last.text += prefix + w.text
    else cur.push({ ...w, text: prefix + w.text })
  }
  if (cur.length) lines.push(cur)
  return lines.length ? lines : [[]]
}

// The handful of GitHub emoji shortcodes bots actually use in comments.
const EMOJI: Record<string, string> = {
  ":rocket:": "🚀",
  ":tada:": "🎉",
  ":sparkles:": "✨",
  ":+1:": "👍",
  ":-1:": "👎",
  ":white_check_mark:": "✅",
  ":heavy_check_mark:": "✔️",
  ":x:": "❌",
  ":warning:": "⚠️",
  ":rotating_light:": "🚨",
  ":fire:": "🔥",
  ":eyes:": "👀",
  ":bug:": "🐛",
  ":memo:": "📝",
  ":point_right:": "👉",
}
const decodeShortcodes = (s: string): string =>
  s.replace(/:[a-z0-9_+-]+:/g, (m) => EMOJI[m] ?? m)

// A bare repo-relative file path (a/b/c.ext), optionally with a :line suffix —
// what bots drop into tables and inline refs, with no link attached. Matched so
// we can synthesise a clickable link (the whole token, so prose never matches).
const FILE_REF_RE = /^((?:[\w.@-]+\/)+[\w.@-]+\.[A-Za-z]\w*)(?::(\d+))?$/
const fileRef = (s: string): { path: string; line?: number } | null => {
  const m = s.trim().match(FILE_REF_RE)
  return m ? { path: m[1], line: m[2] ? Number(m[2]) : undefined } : null
}

const isSeparatorRow = (l: string): boolean =>
  l.includes("|") && /^[\s|:-]*-[\s|:-]*$/.test(l.trim())
const tableCells = (l: string): string[] =>
  l
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim())

// Public: render a raw markdown body into styled, wrapped terminal lines.
// `fileLink`, when given, turns bare repo-relative paths (in tables and on their
// own line) into a full clickable URL rendered dim beneath the reference.
export const renderMarkdown = (
  raw: string,
  width: number,
  fileLink?: (path: string, line?: number) => string,
): StyledLine[] => {
  if (!raw || !raw.trim()) return []
  const normalised = decodeShortcodes(
    htmlToText(decodeEntities(raw.replace(/\r\n?/g, "\n"))),
  )

  const out: StyledLine[] = []
  const push = (text: string, style: Partial<StyledLine>, indent = 0) => {
    for (const w of wrap(text, width - indent))
      out.push({ text: " ".repeat(indent) + w, ...style })
  }

  // Emit inline-styled text (bold / code / italic) as span lines, with an
  // optional prefix (e.g. a bullet) on the first line and a hanging indent on
  // continuations.
  const emitSpans = (raw: string, indent = 0, prefix = "") => {
    const avail = Math.max(8, width - indent - prefix.length)
    const wrapped = wrapSpans(parseInline(linkify(raw)), avail)
    wrapped.forEach((lineSpans, k) => {
      const lead =
        k === 0
          ? " ".repeat(indent) + prefix
          : " ".repeat(indent + prefix.length)
      out.push({ text: "", spans: [{ text: lead }, ...lineSpans] })
    })
  }

  // Render a pipe-table as records — first cell as an accent key, the rest
  // indented beneath (labelled when >2 columns). Wide bot tables (file paths +
  // prose) read cleanly this way and never overflow the terminal.
  const renderTable = (header: string[], rows: string[][]) => {
    for (const row of rows) {
      const first = stripInline(row[0] ?? "")
      if (first) {
        push(first, { color: colors.accent, bold: true })
        if (fileLink) {
          const ref = fileRef(first)
          if (ref) push(fileLink(ref.path, ref.line), { dim: true }, 2)
        }
      }
      for (let c = 1; c < row.length; c++) {
        const val = stripInline(row[c] ?? "")
        if (!val) continue
        const label =
          header.length > 2 && header[c] ? `${stripInline(header[c])}: ` : ""
        push(label + val, {}, 2)
      }
      out.push({ text: "" })
    }
  }

  const src = normalised.split("\n")
  let inFence = false
  let i = 0
  while (i < src.length) {
    const line = src[i].replace(/\s+$/, "")

    if (/^\s*```/.test(line)) {
      inFence = !inFence
      i++
      continue
    }
    if (inFence) {
      out.push({ text: "  " + line, color: CODE_COLOR })
      i++
      continue
    }

    // markdown pipe-table: a `| … |` header followed by a `|---|---|` separator
    if (
      line.includes("|") &&
      i + 1 < src.length &&
      isSeparatorRow(src[i + 1])
    ) {
      const header = tableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < src.length && src[i].includes("|") && src[i].trim()) {
        rows.push(tableCells(src[i]))
        i++
      }
      renderTable(header, rows)
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push({ text: "─".repeat(Math.min(width, 40)), dim: true })
      i++
      continue
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      push(stripInline(heading[2]), { color: colors.accent, bold: true })
      i++
      continue
    }

    // a line that is *only* a file path (e.g. greptile's `foo/bar.ts:67`) →
    // keep the path as an accent header and drop the clickable URL beneath it.
    if (fileLink) {
      const ref = fileRef(line)
      if (ref) {
        push(ref.path + (ref.line ? `:${ref.line}` : ""), {
          color: colors.accent,
          bold: true,
        })
        push(fileLink(ref.path, ref.line), { dim: true }, 2)
        i++
        continue
      }
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = stripInline(line.replace(/^\s*>\s?/, ""))
      for (const w of wrap(quote, width - 2))
        out.push({ text: "│ " + w, color: colors.info })
      i++
      continue
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      emitSpans(bullet[2], bullet[1].length, "• ")
      i++
      continue
    }

    if (!line.trim()) {
      out.push({ text: "" })
      i++
      continue
    }
    emitSpans(line.trimStart(), line.length - line.trimStart().length)
    i++
  }

  // collapse consecutive blank lines; trim trailing blanks. A line is blank
  // only when it has neither text nor spans (span lines carry text: "").
  const isBlank = (l?: StyledLine) => !!l && !l.spans && l.text === ""
  const collapsed: StyledLine[] = []
  for (const l of out) {
    if (isBlank(l) && isBlank(collapsed[collapsed.length - 1])) continue
    collapsed.push(l)
  }
  while (isBlank(collapsed[collapsed.length - 1])) collapsed.pop()
  return collapsed
}
