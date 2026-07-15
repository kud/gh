import { ghGraphql, ghRest } from "./gh.js"

export type Comment = {
  author: string
  body: string
  databaseId?: number
  url?: string
  path?: string | null
  diffHunk?: string
  createdAt?: string
}

export type ReviewThread = {
  id: string
  path: string | null
  line: number | null
  originalLine: number | null
  isResolved: boolean
  isOutdated: boolean
  comments: Comment[]
}

export type PrComments = {
  headRef: string
  conversation: Comment[]
  threads: ReviewThread[]
}

export type ReplyToThreadOptions = {
  repo: string
  pull: number
  inReplyTo: number
  body: string
}

type GhAuthor = { login: string } | null

type ConversationCommentNode = {
  author: GhAuthor
  body: string
}

type ThreadCommentNode = {
  databaseId: number
  author: GhAuthor
  body: string
  bodyText: string
  url: string
  path: string | null
  diffHunk: string
  createdAt: string
}

type ReviewThreadNode = {
  id: string
  path: string | null
  line: number | null
  originalLine: number | null
  isResolved: boolean
  isOutdated: boolean
  comments: { nodes: ThreadCommentNode[] }
}

type FetchPrCommentsResponse = {
  repository: {
    pullRequest: {
      headRefName: string
      comments: { nodes: ConversationCommentNode[] }
      reviewThreads: { nodes: ReviewThreadNode[] }
    } | null
  } | null
}

type ResolveThreadResponse = {
  resolveReviewThread: { thread: { isResolved: boolean } }
}

type UnresolveThreadResponse = {
  unresolveReviewThread: { thread: { isResolved: boolean } }
}

const FETCH_PR_COMMENTS_QUERY = `
  query($owner:String!, $name:String!, $number:Int!) {
    repository(owner:$owner, name:$name) {
      pullRequest(number:$number) {
        headRefName
        comments(first: 50) { nodes { author { login } body } }
        reviewThreads(first: 100) {
          nodes {
            id path line originalLine isResolved isOutdated
            comments(first: 100) {
              nodes { databaseId author { login } body bodyText url path diffHunk createdAt }
            }
          }
        }
      }
    }
  }
`

const RESOLVE_THREAD_MUTATION = `
  mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { isResolved }
    }
  }
`

const UNRESOLVE_THREAD_MUTATION = `
  mutation($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread { isResolved }
    }
  }
`

const authorLogin = (author: GhAuthor): string => author?.login ?? "ghost"

const mapConversationComment = (node: ConversationCommentNode): Comment => ({
  author: authorLogin(node.author),
  body: node.body.trim(),
})

const mapThreadComment = (node: ThreadCommentNode): Comment => ({
  author: authorLogin(node.author),
  body: node.body.trim(),
  databaseId: node.databaseId,
  url: node.url,
  path: node.path,
  diffHunk: node.diffHunk,
  createdAt: node.createdAt,
})

const mapReviewThread = (node: ReviewThreadNode): ReviewThread => ({
  id: node.id,
  path: node.path,
  line: node.line,
  originalLine: node.originalLine,
  isResolved: node.isResolved,
  isOutdated: node.isOutdated,
  comments: node.comments.nodes.map(mapThreadComment),
})

export const fetchPrComments = async (
  owner: string,
  name: string,
  number: number,
): Promise<PrComments> => {
  const data = await ghGraphql<FetchPrCommentsResponse>(
    FETCH_PR_COMMENTS_QUERY,
    {
      owner,
      name,
      number,
    },
  )

  const pullRequest = data.repository?.pullRequest

  if (!pullRequest) {
    throw new Error(`pull request not found: ${owner}/${name}#${number}`)
  }

  return {
    headRef: pullRequest.headRefName ?? "HEAD",
    conversation: pullRequest.comments.nodes.map(mapConversationComment),
    threads: pullRequest.reviewThreads.nodes.map(mapReviewThread),
  }
}

export const replyToThread = async (
  options: ReplyToThreadOptions,
): Promise<void> => {
  await ghRest(`repos/${options.repo}/pulls/${options.pull}/comments`, {
    fields: { body: options.body, in_reply_to: options.inReplyTo },
  })
}

export const resolveThread = async (threadId: string): Promise<boolean> => {
  const data = await ghGraphql<ResolveThreadResponse>(RESOLVE_THREAD_MUTATION, {
    threadId,
  })
  return data.resolveReviewThread.thread.isResolved
}

export const unresolveThread = async (threadId: string): Promise<boolean> => {
  const data = await ghGraphql<UnresolveThreadResponse>(
    UNRESOLVE_THREAD_MUTATION,
    { threadId },
  )
  return data.unresolveReviewThread.thread.isResolved
}
