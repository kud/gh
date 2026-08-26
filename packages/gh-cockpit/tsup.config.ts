import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/extensions/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node20",
  treeshake: true,
})
