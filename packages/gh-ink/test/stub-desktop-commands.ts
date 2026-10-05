import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

// The inbox shells out to macOS desktop commands (`open` a URL, `osascript`
// into iTerm2, `pbcopy`). Tests drive real keypresses over fixture rows, so
// without this every run opens fixture URLs in the browser and clobbers the
// clipboard. Shadow them on PATH with no-op stubs for the whole run.
const DESKTOP_COMMANDS = ["open", "osascript", "pbcopy"]

const stubDir = mkdtempSync(join(tmpdir(), "gh-ink-test-bin-"))
for (const command of DESKTOP_COMMANDS) {
  const stub = join(stubDir, command)
  writeFileSync(stub, "#!/bin/sh\nexit 0\n")
  chmodSync(stub, 0o755)
}
process.env.PATH = `${stubDir}${delimiter}${process.env.PATH ?? ""}`
