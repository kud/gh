import { colors } from "@kud/ink-ui"

// What the inbox search bar draws for each of its two states, as data rather
// than JSX.
//
// A kept filter used to look exactly like a field still taking keys — same
// `/`, same hints minus the typing verbs — so nothing on screen said whether
// `c` was a letter or a command. The caret already marks the typing state
// (ink-ui's FilterBar contract: it is the one visible difference between a
// field that takes keys and a filter that merely stands), but a piped frame
// carries no colour and a test frame carries no escape codes, so the kept
// state needed its own WORDS as well as its own tint: `filtered · keys
// active` says the letters are hotkeys again, where `↑↓ move · ↵/esc done` says
// they type. The magnifier is the nerd-font half of the same distinction —
// text mode keeps the `/` the keys contract already names.
//
// Kept here (and exported) rather than inline because colour is unobservable
// in a rendered frame: the unit tests pin the token choice on this function,
// while the render tests pin the glyph, the caret and the words on the frame.

/** Nerd-font magnifier (oct-search), written as an escape — never a raw byte. */
export const SEARCH_GLYPH_NERD = "\uF422"

/** What stands at the head of the bar: the magnifier under nerd fonts, `/` elsewhere. */
export const searchGlyph = (nerd: boolean): string =>
  nerd ? SEARCH_GLYPH_NERD : "/"

export type SearchBarState = {
  /** Head glyph, without its surrounding padding. */
  glyph: string
  /** Token for the head glyph: lit while typing, furniture once kept. */
  glyphColor: string
  /** The caret shows only while the field owns the keyboard. */
  caret: boolean
  /** Trailing hint words, without the match count that precedes them. */
  hints: string
}

/**
 * The bar's two states. `typing` is `useFilterMode`'s `typing`; `nerd` is
 * `getIconMode() === "nerd"`, read at the call site so this stays pure.
 * The typing words repeat the hook's own verbs — the bar still renders
 * `filter.hints` live while typing, as before — so the two states can be
 * asserted side by side, and the render test pins the live words on the
 * frame, so the copy here cannot drift from the hook unnoticed.
 */
export const searchBarState = ({
  typing,
  nerd,
}: {
  typing: boolean
  nerd: boolean
}): SearchBarState => ({
  glyph: searchGlyph(nerd),
  glyphColor: typing ? colors.info : colors.muted,
  caret: typing,
  hints: typing
    ? "↑↓ move · ↵/esc done · ⌃u clear"
    : "filtered · keys active · esc clear",
})
