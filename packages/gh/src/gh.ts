import { execa } from "execa"

export type GhFieldValue = string | number

export type GhFields = Record<string, GhFieldValue>

const toFieldArgs = (fields: GhFields): string[] =>
  Object.entries(fields).flatMap(([key, value]) =>
    typeof value === "number"
      ? ["-F", `${key}=${value}`]
      : ["-f", `${key}=${value}`],
  )

export const ghGraphql = async <T>(
  query: string,
  vars: GhFields = {},
): Promise<T> => {
  const { stdout } = await execa("gh", [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    ...toFieldArgs(vars),
  ])

  return JSON.parse(stdout).data as T
}

export type GhRestMethod = "GET" | "POST" | "PATCH" | "DELETE"

export type GhRestOptions = {
  method?: GhRestMethod
  fields?: GhFields
}

export const ghRest = async (
  endpoint: string,
  options: GhRestOptions = {},
): Promise<string> => {
  const { method, fields = {} } = options
  const methodArgs = method ? ["-X", method] : []

  const { stdout } = await execa("gh", [
    "api",
    endpoint,
    ...methodArgs,
    ...toFieldArgs(fields),
  ])

  return stdout
}
