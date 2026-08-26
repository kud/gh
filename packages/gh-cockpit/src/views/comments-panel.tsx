import { $ } from "zx"
import { fetchPrComments, type PrComments } from "@kud/gh"

// Adapter over the @kud/gh family: the interactive comments UI now lives in
// @kud/gh-ink (consumed by cockpit *and* the standalone gh-pr-comments CLI), and
// the data layer in @kud/gh. This file keeps cockpit's call sites unchanged —
// pr-view imports { CommentsPanel, fetchComments } from here as before.
export { CommentsPanel } from "@kud/gh-ink"

export type Loaded = PrComments

// Issues are shaped into the same PrComments payload the panel already takes,
// with an empty thread list. That is not a hack around the type: an issue IS a
// conversation with no review threads, and CommentsPanel already skips the
// threads section and guards every thread key on length. Feeding both kinds
// through one renderer is what makes the two detail screens the same screen.
export const fetchComments = async (
  repo: string,
  number: number,
  kind: "pr" | "issue" = "pr",
): Promise<Loaded> => {
  if (kind === "issue") return fetchIssueConversation(repo, number)
  const [owner, name] = repo.split("/")
  return fetchPrComments(owner, name, number)
}

const ISSUE_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      comments(first: 50) { nodes { author { login } body createdAt url } }
    }
  }
}`

const fetchIssueConversation = async (
  repo: string,
  number: number,
): Promise<Loaded> => {
  const [owner, name] = repo.split("/")
  const [body, rest] = await Promise.all([
    fetchBody("issue", repo, number),
    $`gh api graphql -f query=${ISSUE_QUERY} -f owner=${owner} -f name=${name} -F number=${number}`.quiet(),
  ])
  const nodes = JSON.parse(rest.stdout).data.repository.issue.comments.nodes
  const comments = (nodes as any[]).map((c) => ({
    author: c.author?.login ?? "ghost",
    body: (c.body ?? "").trim(),
    createdAt: c.createdAt,
    url: c.url,
  }))
  return {
    headRef: "",
    conversation: body ? [body, ...comments] : comments,
    threads: [],
  }
}

// Issues only — @kud/gh's fetchPrComments leads the conversation with the PR
// body itself, so doing it here too would render the description twice.
const fetchBody = async (
  kind: "pr" | "issue",
  repo: string,
  number: number,
) => {
  try {
    const { stdout } =
      await $`gh ${kind} view ${number} --repo ${repo} --json body,author,createdAt`.quiet()
    const node = JSON.parse(stdout)
    const text = (node.body ?? "").trim()
    return text
      ? {
          author: node.author?.login ?? "",
          body: text,
          createdAt: node.createdAt,
        }
      : null
  } catch {
    return null
  }
}
