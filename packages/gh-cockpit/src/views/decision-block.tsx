import React from "react"
import { Box, Text } from "ink"
import { colors } from "@kud/ink-ui"
import type { NeedsYou } from "../lib.js"

// The pinned decision line at the top of a drill view, directly under the
// summary: what the viewer is being asked, in the host's own words. Compact on
// purpose — a heading and one line, no border — because it sits above the tabs
// on every drill and a frame around it would read as a third tab. A merge-band
// row has nothing to decide, so it says so plainly rather than drawing an
// empty heading.
export const DecisionBlock = ({ needsYou }: { needsYou: NeedsYou }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text color={colors.accent} bold>
      Decision
    </Text>
    {needsYou.decision ? (
      <Text>{needsYou.decision}</Text>
    ) : (
      <Text dimColor>Nothing to decide: ready to merge.</Text>
    )}
  </Box>
)
