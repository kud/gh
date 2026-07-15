import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node20",
  // Keep the entry's #! shebang so the built file is directly executable.
  banner: { js: "#!/usr/bin/env node" },
})
