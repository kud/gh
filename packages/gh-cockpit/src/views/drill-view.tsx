import React from "react"
import { Box, Text, useWindowSize } from "ink"
import { colors, FooterHints, Panel } from "@kud/ink-ui"
import { useChrome } from "../lib.js"

// Shared chrome for mounted drill views (comments / checks / issue): the title
// becomes the inbox header's breadcrumb and the hints the persistent footer's
// verbs, through `useChrome` — instead of a second frame inside the inbox's.
//
// Which frame depends on where this mounts. Inside the inbox shell a provider
// claims the title and hints and this renders only the body: the inbox frame,
// its title row and its footer stay on screen, and the drill sits in the
// content area between them. Mounted standalone (a domain CLI, a unit test)
// there is no provider, `useChrome` is a no-op, and this draws the legacy
// full-height frame — the same component renders framed alone and chromeless
// in the shell, so hosts that mount these views directly keep what they had.
//
// The hints the shell appends its own tail to (`⌫ back`, `q quit`) are stripped
// here, not there: every drill names `esc` for leaving, and the shell drawing
// it again beside the body's own would put two ways back on one footer.
const SHELL_KEYS = new Set(["esc", "⌫", "q", "?"])

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
  const inShell = useChrome({
    scope: title,
    hints: hints.filter(([key]) => !SHELL_KEYS.has(key)),
  })
  if (inShell) {
    return (
      <Box flexDirection="column">
        {subtitle ? (
          <Box marginBottom={1}>
            <Text bold>{"Title: "}</Text>
            <Text>{subtitle}</Text>
          </Box>
        ) : null}
        {children}
      </Box>
    )
  }
  return <LegacyDrillView title={title} subtitle={subtitle} hints={hints} children={children} />
}

// The standalone frame, byte-for-byte what every drill drew before the shell
// kept its own chrome: header on top, content growing to fill, footer pinned
// to the bottom — so a mounted view fills the terminal like the inbox, instead
// of floating.
//
// The Panel border is what makes a drill read like the same product as the
// Jenkins explorer (J), which gets its chrome from @kud/jenkins-ink's assembled
// <JenkinsBody>. Without it, drills that hand-assemble -ink leaves came out flat
// while the assembled body came out framed — same data, two different finishes.
// Unfocused and untitled, so it stays chrome: there's one pane here, and a focus
// border would signal a distinction that doesn't exist.
const LegacyDrillView = ({
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
