import type { PrHealthData } from "@kud/gh"

// Fixtures behind `--mock`, for the cli-shot contract: a screenshot or a web
// demo outlives the moment it was taken, so it must never show a real
// repository, a real reviewer or a real run. Every name, number and URL below
// is invented. Each screen is one PR caught at a different moment of its life,
// because the panel itself has a single view — what changes between frames
// worth showing is the state of the PR, not the layout.

export type Fixture = { repo: string; number: number; data: PrHealthData }

const REPO = "acme/api-gateway"
const run = (id: number) =>
  `https://github.com/${REPO}/actions/runs/${id}/job/${id + 7}`

const base = {
  author: { login: "rowan-hale" },
  additions: 214,
  deletions: 61,
  changedFiles: 9,
  baseRefName: "main",
}

export const FIXTURES: Record<string, Fixture> = {
  failing: {
    repo: REPO,
    number: 482,
    data: {
      ...base,
      statusCheckRollup: [
        {
          workflowName: "ci",
          name: "lint",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9101),
        },
        {
          workflowName: "ci",
          name: "typecheck",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9101),
        },
        {
          workflowName: "ci",
          name: "test (node 22)",
          status: "COMPLETED",
          conclusion: "FAILURE",
          detailsUrl: run(9101),
        },
        {
          workflowName: "ci",
          name: "test (node 24)",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9101),
        },
        {
          workflowName: "e2e",
          name: "contract",
          status: "COMPLETED",
          conclusion: "CANCELLED",
          detailsUrl: run(9102),
        },
        {
          context: "coverage/patch",
          state: "SUCCESS",
          targetUrl: "https://coverage.example.com/acme/api-gateway/482",
        },
      ],
      reviews: [
        { author: { login: "imogen-vale" }, state: "CHANGES_REQUESTED" },
        { author: { login: "tobias-lund" }, state: "COMMENTED" },
      ],
      reviewDecision: "CHANGES_REQUESTED",
      mergeable: "MERGEABLE",
      mergeStateStatus: "BLOCKED",
    },
  },
  pending: {
    repo: REPO,
    number: 486,
    data: {
      ...base,
      additions: 38,
      deletions: 12,
      changedFiles: 3,
      statusCheckRollup: [
        {
          workflowName: "ci",
          name: "lint",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9140),
        },
        {
          workflowName: "ci",
          name: "typecheck",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9140),
        },
        {
          workflowName: "ci",
          name: "test (node 22)",
          status: "IN_PROGRESS",
          conclusion: null,
          detailsUrl: run(9140),
        },
        {
          workflowName: "ci",
          name: "test (node 24)",
          status: "IN_PROGRESS",
          conclusion: null,
          detailsUrl: run(9140),
        },
        {
          workflowName: "e2e",
          name: "contract",
          status: "QUEUED",
          conclusion: null,
          detailsUrl: run(9141),
        },
      ],
      reviews: [],
      reviewDecision: "REVIEW_REQUIRED",
      mergeable: "MERGEABLE",
      mergeStateStatus: "BLOCKED",
    },
  },
  ready: {
    repo: REPO,
    number: 479,
    data: {
      ...base,
      statusCheckRollup: [
        {
          workflowName: "ci",
          name: "lint",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9077),
        },
        {
          workflowName: "ci",
          name: "typecheck",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9077),
        },
        {
          workflowName: "ci",
          name: "test (node 22)",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9077),
        },
        {
          workflowName: "ci",
          name: "test (node 24)",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9077),
        },
        {
          workflowName: "e2e",
          name: "contract",
          status: "COMPLETED",
          conclusion: "SUCCESS",
          detailsUrl: run(9078),
        },
        {
          context: "coverage/patch",
          state: "SUCCESS",
          targetUrl: "https://coverage.example.com/acme/api-gateway/479",
        },
      ],
      reviews: [
        { author: { login: "imogen-vale" }, state: "APPROVED" },
        { author: { login: "tobias-lund" }, state: "APPROVED" },
      ],
      reviewDecision: "APPROVED",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
    },
  },
}

export const SCREENS = Object.keys(FIXTURES)
