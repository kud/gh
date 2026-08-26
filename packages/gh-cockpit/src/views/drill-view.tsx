import React from "react"
import { Box, Text, useWindowSize } from "ink"
import { colors, FooterHints, Panel } from "@kud/ink-ui"

// Shared full-height frame for mounted drill views (comments / checks / issue):
// header on top, content grows to fill, footer pinned to the bottom — so a
// mounted view fills the terminal like the inbox, instead of floating.
//
// The Panel border is what makes a drill read like the same product as the
// Jenkins explorer (J), which gets its chrome from @kud/jenkins-ink's assembled
// <JenkinsBody>. Without it, drills that hand-assemble -ink leaves came out flat
// while the assembled body came out framed — same data, two different finishes.
// Unfocused and untitled, so it stays chrome: there's one pane here, and a focus
// border would signal a distinction that doesn't exist.
export const DrillView = ({
  title,
  subtitle,
  hints,
  children,
}: {
  title: string
  subtitle?: string
  hints: [string, string][]
  children: React.ReactNode
}) => {
  const { rows } = useWindowSize()
  // The border costs a row top and bottom. Spend the height inside the Panel,
  // or the frame overflows the terminal and ghosts in the alternate screen.
  // paddingX lives here rather than on Panel: Panel is a border primitive and
  // deliberately doesn't pad, so content would otherwise sit against the frame.
  return (
    <Panel>
      <Box flexDirection="column" height={rows - 2} paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.accent} bold>
            {title}
          </Text>
          {subtitle ? (
            <Box marginTop={1}>
              <Text bold>{"Title: "}</Text>
              <Text>{subtitle}</Text>
            </Box>
          ) : null}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {children}
        </Box>
        <FooterHints hints={hints} />
      </Box>
    </Panel>
  )
}
