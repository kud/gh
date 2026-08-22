import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // The transit and merged specs wait out real hold timers, which are now
    // longer than vitest's 5s default.
    testTimeout: 30_000,
  },
})
