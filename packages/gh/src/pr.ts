import { execa } from "execa"

export type CurrentPr = {
  number: number
  repo: string
  url: string
  title: string
  branch: string
}

// Resolve the open PR for the branch checked out in the current directory. The
// repo is taken from the PR url (canonical owner/name, robust to forks), falling
// back to the head repository fields.
export const resolveCurrentPr = async (): Promise<CurrentPr> => {
  const { stdout } = await execa("gh", [
    "pr",
    "view",
    "--json",
    "number,title,url,headRefName,headRepository,headRepositoryOwner",
  ])
  const pr = JSON.parse(stdout) as {
    number: number
    title: string
    url: string
    headRefName: string
    headRepository: { name: string }
    headRepositoryOwner: { login: string }
  }
  const repo =
    pr.url.match(/github\.com\/([^/]+\/[^/]+)\/pull\//)?.[1] ??
    `${pr.headRepositoryOwner.login}/${pr.headRepository.name}`
  return {
    number: pr.number,
    repo,
    url: pr.url,
    title: pr.title,
    branch: pr.headRefName,
  }
}
