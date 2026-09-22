import React, { createContext, useContext, type ReactNode } from "react"
import { Text as InkText, Box } from "ink"

/*
 * The backdrop: what the list looks like while an overlay is over it.
 *
 * Its own module because the context below has to be a SINGLE instance. The
 * inbox and the row components both read it, and two modules each calling
 * `createContext` would compile, render, and silently disagree — the provider
 * feeding one instance while the consumers read the other, so the list would
 * simply never dim. That is the module-level-singleton trap `CLAUDE.md` records
 * for `@kud/ink-ui`, one scale down and inside this package.
 *
 * Everything that reads the flag ships from here too — `Text` above all, since
 * a second copy of the shadowing wrapper is the same divergence wearing a
 * different name.
 */

// Ink has no cascade — every Text carries its own colour — so a subtree cannot be
// dimmed from above. The flag travels by context and the wrapper below applies
// it, which is why this module imports Ink's Text as `InkText` and shadows the
// name: every existing `<Text>` in the file became backdrop-aware without a
// single call site changing.
const DimContext = createContext(false)

/*
 * Two planes for the list to fall back to, both in `OVERLAY_BG`'s barely-blue
 * hue family so the scene reads as one temperature rather than a grey list
 * behind a slate panel.
 *
 * Two rather than one because a single tone collapses the list to a mat, and
 * the point of a backdrop is that something structured is behind the panel: the
 * repo headers still read as headers and the ages as a right-hand column, at a
 * contrast where you can see the list's shape without being able to read it.
 */
const BACKDROP_FG = "#5a5a68"
const BACKDROP_FG_RECESSED = "#3a3a46"

/*
 * The backdrop REPLACES colour rather than attenuating it, and drops SGR 2 on
 * the way out.
 *
 * `dimColor` was the whole mechanism and it does not survive contact with a real
 * terminal. Faint is a single binary attribute whose meaning is the terminal's
 * to decide, and measured on iTerm2 it barely moves a 24-bit foreground: the
 * escape codes for a row were byte-identical either side of the overlay —
 * `[38;2;255;135;0]` both times — so the list's orange came through at full
 * strength with the panel over it. There is no "more dim" available. Anything
 * that actually recedes has to change the colour that gets emitted.
 *
 * Both would be worse than either. Set a flat colour AND leave faint on and the
 * two planes stop being the values chosen here and become whatever this
 * terminal does with SGR 2 — the exact failure being fixed, one layer along.
 *
 * `dimColor` at the call site is reused as the plane selector rather than
 * re-encoded, which is the same trick as the shadow itself one turn further:
 * every element that already declared itself furniture — prefixes, repo, age,
 * author, a departing title — says so again here, one step further back, and
 * not one call site changes. Bold and italic go with it, being texture rather
 * than emphasis at this contrast. `strikethrough` stays: it is shape.
 *
 * The health glyphs and the turn arrows lose their hues for as long as an
 * overlay is up, and that is `health-display.ts`'s contract being SPENT rather
 * than broken — the glyph is what distinguishes a state and colour only ever
 * reinforced it, and every one of those glyphs passes a silhouette test by
 * construction. The backdrop is also not being read: nobody diagnoses a PR
 * through the list behind a dialog they are operating, so what goes is a
 * scanning aid during the one moment nothing is being scanned. It returns with
 * the next frame.
 */
type TextProps = React.ComponentProps<typeof InkText>

/**
 * The style a `Text` takes when it is behind an overlay.
 *
 * Exported as a function so it can be asserted without rendering. Colour only
 * reaches a frame if chalk decides to emit it, and chalk decides from the
 * runner's TTY — so a spec that mounts the app and greps the frame for escape
 * codes passes vacuously wherever the output is piped, which is a check that
 * cannot fail sitting in the count beside ones that can. Forcing colour on for
 * the whole package is not the answer either: ten existing specs measure raw
 * frame widths and break the moment codes appear in them. The decision is pure,
 * so pin the decision.
 */
export const backdropStyle = (props: TextProps): Partial<TextProps> => ({
  color: props.dimColor ? BACKDROP_FG_RECESSED : BACKDROP_FG,
  dimColor: false,
  bold: false,
  italic: false,
  inverse: false,
  backgroundColor: undefined,
})

export const Text = ({ children, ...props }: TextProps) => {
  const dimmed = useContext(DimContext)
  return dimmed ? (
    <InkText {...props} {...backdropStyle(props)}>
      {children}
    </InkText>
  ) : (
    <InkText {...props}>{children}</InkText>
  )
}

/**
 * Whether this subtree is currently behind an overlay.
 *
 * Exists for the one thing the shadow above cannot reach: `Pill` comes from
 * `@kud/ink-ui` and renders that package's `Text`, so it never sees the context
 * and keeps its fill. Harmless while the backdrop merely lost its bold; once the
 * list flattens to a single recessive tone a filled pill becomes the most
 * saturated thing on the screen, behind a panel that is supposed to be in front.
 */
export const useBackdropped = (): boolean => useContext(DimContext)

// The list, dimmed and lifted out of the flow so an overlay can be laid over it.
// Ink paints in document order, so the backdrop has to come FIRST and the panel
// second — the reverse (panel absolute, over a list in flow) reads more naturally
// and is wrong twice: it paints under, and a panel taller than `height` is
// centre-clipped, losing its border and its last line. In flow the panel simply
// grows the row instead.
export const Backdrop = ({
  dimmed,
  absolute,
  height,
  children,
}: {
  dimmed: boolean
  absolute: boolean
  height: number
  children: ReactNode
}) => (
  <DimContext.Provider value={dimmed}>
    {absolute ? (
      <Box
        position="absolute"
        flexDirection="column"
        width="100%"
        height={height}
      >
        {children}
      </Box>
    ) : (
      children
    )}
  </DimContext.Provider>
)
