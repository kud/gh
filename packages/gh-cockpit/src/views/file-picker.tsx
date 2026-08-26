import { $ } from "zx"
import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { colors, useListCursor } from "@kud/ink-ui"
import { DrillView } from "./drill-view.js"
import { resolveRepoPath, openInTab } from "../lib.js"

type FileRef = { path: string; line: number | null }

const QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) { nodes { path line } }
    }
  }
}`

const fetchFiles = async (repo: string, number: number): Promise<FileRef[]> => {
  const [owner, name] = repo.split("/")
  const out =
    await $`gh api graphql -f query=${QUERY} -f owner=${owner} -f name=${name} -F number=${number}`.quiet()
  const nodes =
    JSON.parse(out.stdout).data.repository.pullRequest.reviewThreads.nodes ?? []
  // one entry per file, keeping the first line commented on
  const seen = new Map<string, FileRef>()
  for (const n of nodes as any[])
    if (n.path && !seen.has(n.path))
      seen.set(n.path, { path: n.path, line: n.line })
  return [...seen.values()]
}

const openInEditor = async (
  repoPath: string,
  file: FileRef,
): Promise<string> => {
  const target = file.line ? `${file.path}:${file.line}` : file.path
  for (const ed of ["cursor", "code"]) {
    if (
      (await $({ nothrow: true, quiet: true })`command -v ${ed}`).exitCode === 0
    ) {
      void $({
        nothrow: true,
        quiet: true,
      })`${ed} -g ${repoPath}/${target}`.catch(() => {})
      return ed
    }
  }
  const editor = process.env.EDITOR || "vi"
  await openInTab(
    `cd ${repoPath} && ${editor} ${file.line ? `+${file.line} ` : ""}${file.path}`,
  )
  return editor
}

// Overlay that lists the files touched by review comments and opens the chosen
// one in your editor at the commented line — resolving the repo's local
// checkout by git-remote scan. Mounts over PrView like the log / AI launcher.
export const FilePicker = ({
  repo,
  number,
  onBack,
}: {
  repo: string
  number: number
  onBack: () => void
}) => {
  const [files, setFiles] = useState<FileRef[] | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetchFiles(repo, number)
      .then((f) => live && setFiles(f))
      .catch((e) => live && setNote((e as Error).message))
    return () => {
      live = false
    }
  }, [repo, number])

  const list = files ?? []
  const { cursor } = useListCursor(list.length)
  const safeCursor = Math.min(cursor, Math.max(0, list.length - 1))

  const open = async (f: FileRef) => {
    setNote(`⋯ resolving ${repo}…`)
    const repoPath = await resolveRepoPath(repo)
    if (!repoPath) {
      setNote(`✗ ${repo} isn't checked out locally`)
      return
    }
    const ed = await openInEditor(repoPath, f)
    setNote(`↗ ${f.path}${f.line ? `:${f.line}` : ""} — ${ed}`)
  }

  useInput((input, key) => {
    if (key.escape || input === "q") return onBack()
    if (key.return && list[safeCursor]) void open(list[safeCursor])
  })

  return (
    <DrillView
      title={`Files · #${number} · ${repo}`}
      subtitle="files touched by review comments"
      hints={[
        ["↑↓", "nav"],
        ["↵", "open in editor"],
        ["q/esc", "back"],
      ]}
    >
      {!files ? (
        <Text color={colors.info}>Fetching files…</Text>
      ) : list.length === 0 ? (
        <Text dimColor>No files referenced in review comments.</Text>
      ) : (
        <Box flexDirection="column">
          {list.map((f, i) => (
            <Box key={f.path}>
              <Text color={colors.info}>
                {i === safeCursor ? "  ❯ " : "    "}
              </Text>
              <Text bold={i === safeCursor}>{f.path}</Text>
              {f.line ? <Text dimColor>{`:${f.line}`}</Text> : null}
            </Box>
          ))}
        </Box>
      )}
      {note ? (
        <Box marginTop={1}>
          <Text color={colors.success}>{"  " + note}</Text>
        </Box>
      ) : null}
    </DrillView>
  )
}
