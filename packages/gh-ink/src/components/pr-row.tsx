import React from "react"
import { Box } from "ink"
import { colors, Pill, pillWidth } from "@kud/ink-ui"
import {
  depthOf,
  impliedLabels,
  labelPriority,
  PIN_MARK,
  sizeOf,
  sizePartsOf,
  type GHItem,
} from "@kud/gh-workflow"
import { displayFor } from "../lib/health-display.js"
import { truncate } from "../lib/truncate.js"
import { Text, useBackdropped } from "../inbox/backdrop.js"

/**
 * How this row is moving through the list right now.
 *
 * The row itself never works this out: whoever owns the list owns the
 * choreography — what counts as an arrival, how long a departure is held, which
 * frame of a ramp is on screen — and hands the row the conclusion. So this
 * enumerates what the TITLE has to say, not what happened upstream to cause it.
 *
 * `withdrawn` is `departing` plus the strike: a row struck through is one that
 * has been taken off the list rather than moved along it, and the two read
 * differently on purpose.
 */
export type RowMotion = "arriving" | "departing" | "withdrawn"

/**
 * A solid pill at the end of the row, saying what just happened to it.
 *
 * Solid because it is an EVENT — `@kud/ink-ui`'s pill law in one line: the
 * column says where it sits, soft says what it is, solid says something
 * happened. The word and the colour are the caller's vocabulary; what the row
 * owns is that the pill is charged against the width budget whether or not it
 * is drawn.
 */
export type RowAnnouncement = { label: string; color: string }

export type PrRowProps = {
  item: GHItem
  active: boolean
  login?: string
  /**
   * Columns available to this row, which is NOT always the frame width: a rail
   * beside the list takes its share, and a budget that does not know the rail is
   * there overflows by exactly the rail.
   */
  cols: number
  /** Overrides the health glyph — the inbox passes its transit/merge frame here. */
  icon?: { glyph: string; color: string }
  /**
   * This row's tree glyphs, already assembled — see `treePrefix`. Empty for a
   * top-level row.
   *
   * A row cannot work this out about itself: it is a fact about the rows BELOW
   * it (is a sibling still to come?) and about its ANCESTORS (does a stem still
   * need to run past this level?), so the list supplies it.
   */
  prefix?: string
  /**
   * Labels carried by EVERY label-bearing row in this section, measured once by
   * the list. Suppressed here for the same reason `impliedLabels` suppresses a
   * repo's conventional ones — a label on every row classifies nothing — but on
   * the section axis, which catches uniformity that comes from the query rather
   * than from a repo convention. Defaulted so a host that does not measure it
   * keeps exactly the behaviour it had.
   */
  uniformLabels?: readonly string[]
  /** How the title reads while the row is coming or going. Still when absent. */
  motion?: RowMotion
  /** In order, left to right. Charged against the width budget either way. */
  announcements?: readonly RowAnnouncement[]
}

/**
 * One pull request or issue, as a single line of a list.
 *
 * The shared renderer: the inbox draws its rows with it, and so does anything
 * else that has a `GHItem` and a width. Everything it knows is in its props —
 * it holds no timers, reads no clock, and has no opinion about whether the list
 * is refreshing. That is deliberate and it is the seam: the choreography of
 * arrival, merge and departure belongs to whoever owns the list, and reaches
 * the row as `icon`, `motion` and `announcements` after the decisions are made.
 */
export const PrRow = ({
  item,
  active,
  login,
  cols,
  icon: iconOverride,
  prefix = "",
  uniformLabels = [],
  motion,
  announcements = [],
}: PrRowProps) => {
  // Read once for the row rather than at each of the pill sites — a hook, so it
  // cannot sit inside a branch.
  const backdropped = useBackdropped()
  const { glyph: healthIcon, color: healthColor } = displayFor(item.health)
  // An override REPLACES the health glyph rather than sitting beside it: this
  // column is one cell wide and every row's title is aligned off it, so a second
  // glyph here would shift the title of exactly the row being watched — which is
  // invariably the row something is happening to. One cell, one occupant, and
  // the caller decides which.
  //
  // Glyph and colour travel together and are taken together, never mixed. A
  // caller that wants the health glyph in a different colour says so by handing
  // the health glyph back, which keeps this line free of a third state where
  // half the cell is overridden.
  const { glyph: icon, color } = iconOverride ?? {
    glyph: healthIcon,
    color: healthColor,
  }
  // Whose turn it is, in its own fixed cell. Arrows rather than the nerd-font
  // comment glyph because this column sits in the aligned zone left of the
  // title: a PUA codepoint that renders double-width in some fonts would shift
  // only the rows that carry one, and a fixed cell exists precisely so the
  // title never moves. ← and → are already proven in this UI's footer hints.
  const spokeLast = !!login && !!item.lastActor && item.lastActor === login
  // A pinned row lands in Your move for a reason no arrow can carry: the arrows
  // report who SPOKE last, and a pin is not a turn in the conversation. Left to
  // the arrow alone it would sit under Your move wearing a grey → that says the
  // opposite. So it gets its own mark, single-width ASCII because this cell is
  // in the aligned zone where a codepoint that renders double-width anywhere
  // would shift only the rows carrying one.
  //
  // NOT `!`, which was the first choice and was wrong: `!` is `conflict` in the
  // health vocabulary, in this same orange, one cell to the left — so a PR that
  // was both rendered `! !` twice in the same colour with nothing to tell the
  // two apart. The colourblind invariant health-display.ts states for its own
  // map has to hold ACROSS the adjacent cells too, not just within one, and
  // `pinMarkIsUnambiguous` in health-display.test.ts now pins that.
  // `→` IS A BLANK, and that is a silhouette ruling rather than a tidy-up.
  //
  // The cursor is `❯` at column 0 and this cell sits at column 4 on a top-level
  // row. Both were small rightward points, so at scan speed — when the eye is
  // asking "which row am I on" — a rightward mark four columns in, present on
  // some rows and not others, was a second candidate answer to that question.
  // The collision is not that two marks are close; it is that they POINT THE
  // SAME WAY while only one of them is on every row.
  //
  // Substituting another rightward glyph (`▸`, `›`, `»`) patches the symptom and
  // lands on a different neighbour — `▸` beside `◆` is two filled blobs in
  // adjacent cells. Blanking separates by DIRECTION, which is a shape channel
  // and therefore survives the colourblind invariant that a hue swap would not.
  // `←` points left; nothing else on the row is a horizontal arrow (not the
  // health map, the transit frames, the merge sparkle, `\u{f086}` or
  // `\u{f02b}`), and the tree run `└─` is furniture two tiers down.
  //
  // Nothing is lost that this cell was carrying. `→` said "you spoke last,
  // nothing is being asked of you" — the ABSENCE of a claim, and absence already
  // draws as a blank here (`none` health is `" "`). The band header says it in
  // words, the thread cell is already quiet on `spokeLast`, and the explain
  // action has room for a sentence. What it buys is a sparse column whose only
  // ink is `←`, the one state that is a claim on you.
  //
  // The accepted cost: "you spoke last" and "we never learned who spoke" now
  // draw alike. The second is a FETCH fact rather than a domain one — the same
  // distinction `UNREAD_DISPLAY` makes — and neither is actionable, so it is not
  // worth a column in the aligned zone.
  const [turnIcon, turnColor] = item.pinned
    ? [PIN_MARK, colors.accent]
    : !login || !item.lastActor || spokeLast
      ? [" ", colors.muted]
      : ["←", colors.accent]
  const numStr = `#${item.number}`.padEnd(7)
  // Hide "by me" — the author suffix is only signal when it's someone else.
  const showAuthor = !!item.author && item.author !== login
  // `+18 -4`, on every PR row that carries it. It was gated on `showAuthor`
  // for one morning (2026-09-11) on the argument that you know the size of
  // your own — and Erwann overruled it the same afternoon: the number is how
  // a list of your own PRs is triaged too, and a cell that appears on the row
  // above and not on yours reads as a column that failed to fill. Absent, not
  // `+0 -0`, when the node never carried it.
  const sizeLabel = sizeOf(item)
  const sizeParts = sizePartsOf(item)
  // Unresolved review threads — a comment glyph (nf-fa-comments) + count, keeping
  // to the single-glyph health vocabulary instead of spelling out "unresolved".
  const unresolvedLabel =
    item.unresolved > 0 ? `\u{f086} ${item.unresolved}` : ""
  // `3h (2d)` — active 3h ago, open for 2d. Collapsed to one value when they
  // agree, so an untouched row does not read as `2d (2d)`.
  //
  // PARENTHESES, NOT A DIVIDER, and the argument this replaces was wrong in a
  // way worth recording. It ran: the left value is by construction the smaller
  // of the two (nothing can be touched before it exists), and that invariant
  // teaches the order without a legend, a colour or a second glyph column.
  //
  // It fails twice. Knowing which value is SMALLER is not knowing which value is
  // WHICH — monotonicity establishes that an ordering exists and says nothing
  // about what the two quantities are. And it only reads as ordered inside one
  // unit: `0m · 1d` is obviously ordered, while `6d · 1w` needs weeks converted
  // to days before the ordering is even visible. Cross-unit pairs are the COMMON
  // case here rather than the edge, because GitHub ages cross units within a
  // fortnight — so the one worked example that would teach the pattern is the
  // one almost never on screen.
  //
  // A parenthetical is read as subordinate to the number beside it by every
  // reader who has ever read anything, which kills the "two peers separated by a
  // dot" reading that was causing the confusion: the bare value is THE age, the
  // parenthetical is the lifetime. It costs nothing — `6d · 1w` and `6d (1w)`
  // are both seven columns, so the budget below is unchanged — and it frees the
  // `·` to mean one thing everywhere else on the row.
  //
  // Kept as a pair as well as a string: the string is what the width budget
  // measures (one cell, one number of columns), the pair is what the renderer
  // needs to paint the two halves at different tiers. Deriving the split back
  // out of the string would mean parsing punctuation the line above just wrote.
  const agePair =
    item.activityAge && item.activityAge !== item.age
      ? { activity: item.activityAge, lifetime: item.age }
      : null
  const ageLabel = agePair
    ? `${agePair.activity} (${agePair.lifetime})`
    : item.age
  // Each announcement is a pill, so the joined suffix below under-prices it by
  // exactly its caps — see the ticket row's budget for the same correction.
  // Charged for every announcement handed in rather than for the one that will
  // actually be drawn: a budget that relies on only ever being given one stays
  // right for precisely as long as that invariant holds upstream, and this row
  // cannot see upstream.
  const pillCaps = announcements.length * 2
  // The boolean was doing two jobs here. This one is "this row hangs under
  // something, so say which repo it belongs to" — unchanged in meaning.
  const repoLabel = depthOf(item) > 0 ? item.repo : ""
  /*
   * At most two labels, best first by the host's ranking and by name after
   * that. Two because the cap is the whole design: a row that shows every label
   * has stopped being a row and become a paragraph, and the title is what it
   * came for.
   *
   * Sorted on a copy — `item.labels` is the caller's array and sorting in place
   * would reorder it under them.
   *
   * The repo's implied labels go first, before the rank and the slice: a label
   * every issue in the repo carries is the group header repeated, and a row
   * whose only label was implied draws no cell at all — a bare glyph would say
   * "classified" with no classification behind it. Filtered after the slice it
   * would take a slot and then vanish.
   */
  // Two axes of "says nothing", unioned: the repo's own convention, and
  // whatever this SECTION happens to make uniform. See `uniformLabels` above
  // for why the second exists — a `label:plan` view spanning five repos is
  // uniform by construction while only one of them is in the config.
  const implied = [...impliedLabels(item.repo), ...uniformLabels]
  const labelNames = (item.labels ?? [])
    .filter((l) => !implied.includes(l))
    .sort((a, b) => labelPriority(a) - labelPriority(b) || a.localeCompare(b))
    .slice(0, 2)

  /*
   * Everything after the title is CONTEXT, and context that costs you the thing
   * it contextualises is a bad trade — so when the row cannot have it all, the
   * trailing furniture is given up in order rather than the title being floored.
   *
   * The floor was the bug. `Math.max(20, cols - fixedWidth)` is fine while the
   * frame is wide and fatal the moment something takes forty columns away: a PR
   * carrying a long repo name and two ages has nothing left, takes the floor
   * anyway, and overflows by exactly the difference. Ink's answer to an
   * overflowing row is not to clip it but to compress every flexible child in it,
   * so the key, the number and the title all shrink together and wrap into a
   * column of fragments — the list stops looking like a list, and anything beside
   * it is pushed off the screen. One row too wide takes the whole frame with it.
   *
   * Order is least-valuable-first, and the two announcements are absent from it:
   * MERGED and the transit labels are the news the row exists to carry that
   * moment, and a row that drops its own headline to keep a repo name has the
   * priority exactly backwards.
   */
  // `labels` is a COUNT, not a flag — how many of the (at most two) label names
  // have been given up. It is the one participant that appears on two rungs of
  // the ladder below, because the two labels are not worth the same: the second
  // is speculative, the first is what the row IS. So it degrades two → one →
  // none rather than vanishing whole.
  const givingUp = {
    author: false,
    size: false,
    threads: false,
    age: false,
    repo: false,
    labels: 0,
  }
  /*
   * `\u{f02b}` (nf-fa-tag) then the names, comma-separated — the same
   * glyph-then-content shape `\u{f086} 2` already uses for unresolved threads,
   * so the vocabulary is learned once. Not a Pill: a pill is drawn filled and
   * means "the row belongs to this category", and two filled pills on the most
   * contended row in the app out-shout the health glyph and the title both.
   *
   * 24 columns for the names is a design cap, not a width fallback — it holds on
   * a 200-column frame too, because past it the cell stops being a marker and
   * becomes a second title. Whole labels only: a clipped classification is a lie
   * you cannot check, since `stat…` could be `status:blocked` or `status:done`,
   * where a clipped title still carries its sense. The one exception is a lone
   * first label longer than the cap, which is truncated rather than dropped —
   * a clipped label still says the row is classified, and nothing says it isn't.
   *
   * Math.max around the subtraction because `slice(0, -1)` drops from the TAIL:
   * a single-label row on the second rung would otherwise keep the very label it
   * was told to give up.
   */
  const LABEL_CELL_MAX = 24
  const labelCell = () => {
    const shown = labelNames.slice(
      0,
      Math.max(0, labelNames.length - givingUp.labels),
    )
    if (shown.length === 0) return ""
    const fitted: string[] = []
    for (const name of shown) {
      const next = [...fitted, name].join(", ")
      if (next.length <= LABEL_CELL_MAX) fitted.push(name)
    }
    if (fitted.length === 0) {
      return `\u{f02b} ${truncate(shown[0], LABEL_CELL_MAX)}`
    }
    return `\u{f02b} ${fitted.join(", ")}`
  }
  const widthOf = () => {
    const suffix = [
      givingUp.age ? "" : ageLabel || "",
      // ASCII only, so no PUA double-width correction — see the label cell.
      givingUp.size ? "" : sizeLabel || "",
      givingUp.threads ? "" : unresolvedLabel,
      showAuthor && !givingUp.author ? `by ${item.author}` : "",
      ...announcements.map((a) => a.label),
    ]
      .filter(Boolean)
      .join("  ")
    // Charged apart from the suffix array because it sits BETWEEN the title and
    // the repo, not in the trailing group — same as repoLabel.
    //
    // The cell's own string counts its glyph as one character; it is charged as
    // two. `\u{f02b}` is a PUA codepoint and this file's turn-arrow comment
    // above already records that PUA can render double-width in some fonts.
    // Tolerable here for exactly the reason it was not there: this cell sits
    // right of the title, so a double-width render shifts trailing furniture
    // rather than the aligned zone. But under-charge it by one and every row
    // carrying a label overflows by one in those fonts — which is the class of
    // bug this whole block exists to prevent. Two leading spaces, then the cell,
    // then the glyph's second column.
    const cell = labelCell()
    return (
      2 +
      prefix.length +
      2 /* health */ +
      2 /* turn */ +
      7 +
      (cell ? 2 + cell.length + 1 : 0) +
      (givingUp.repo ? 0 : repoLabel.length) +
      suffix.length +
      pillCaps +
      6
    )
  }
  // Short enough to still say something, long enough to be worth reading. Below
  // this the row is better off shedding its context than its subject.
  const MIN_TITLE = 24
  //
  // The label cell takes two of these rungs. The second label goes early — it is
  // the most speculative thing on the row — and the first outlives both the
  // thread count and the repo, because by then the row is down to what it IS.
  //
  // Assignment rather than `+= 1`, so each rung states the resulting count
  // outright and reordering this array cannot silently produce the wrong one.
  //
  // Size outlives the author — on a review queue "by X" is the least
  // discriminating thing on the row — and the speculative second label, and
  // dies before the thread count: a thread is a claim on you NOW, a size is an
  // aid to deciding WHETHER to engage, and the PR header still holds it.
  for (const give of [
    () => (givingUp.author = true),
    () => (givingUp.labels = 1),
    () => (givingUp.size = true),
    () => (givingUp.threads = true),
    () => (givingUp.labels = 2),
    () => (givingUp.repo = true),
    () => (givingUp.age = true),
  ]) {
    if (cols - widthOf() >= MIN_TITLE) break
    give()
  }
  const labelLabel = labelCell()
  // Never below 1: with everything given up the row is as short as it can be, and
  // a negative budget would hand `truncate` nonsense. A frame that narrow has
  // bigger problems than this row.
  const titleMax = Math.max(1, cols - widthOf())

  return (
    <Box>
      <Text color={colors.info}>{active ? "❯ " : "  "}</Text>
      <Text dimColor>{prefix}</Text>
      <Text color={color as any} bold>
        {icon + " "}
      </Text>
      <Text color={turnColor as any} bold={turnIcon === "←"}>
        {turnIcon + " "}
      </Text>
      <Text color={colors.accent}>{numStr}</Text>
      {/* Three channels, one per state, and none of them colour: bold for a row
          coalescing into the list, dim for one on its way out, and the strike on
          top of the dim for one struck off it entirely. Shape and weight rather
          than hue, so the distinction survives a colourblind reader and a piped
          frame alike. */}
      <Text
        bold={active || motion === "arriving"}
        dimColor={motion === "departing" || motion === "withdrawn"}
        strikethrough={motion === "withdrawn"}
      >
        {truncate(item.title, titleMax) + "  "}
      </Text>
      {/* Straight after the title and before the repo, not out in the trailing
          furniture: a label says what the row IS, so it is read as part of the
          subject rather than scanned down a column — which is why `age` is
          pinned right and this is not. Hueless on purpose, and one tier above the
          furniture: `dimColor` is what the age renders in, and a middle tier
          drawn in the bottom one is not quiet, it is absent — the labels were
          measured at the same L* as the age and read as noise. `secondary` is
          the same tone the turn arrow and the answered thread count wear, so
          the row has three neutrals and no more. GitHub's own
          per-label colour is authored in a repo with no knowledge of this
          palette, and it would be the one place on the row where hue alone did
          the discriminating, which is the failure health-display.ts exists to
          prevent. Casing is verbatim: the string is what you would type back
          into `gh --label`, and uppercase is already claimed here by the pills,
          which are announcements rather than standing classifications. */}
      {labelLabel ? (
        <Text color={colors.secondary}>{labelLabel + "  "}</Text>
      ) : null}
      {repoLabel && !givingUp.repo ? <Text dimColor>{repoLabel}</Text> : null}
      {/* Head of the trailing group: after the title the eye asks how big,
          then how contested, then who, then when. Additions in `colors.success`,
          deletions in `colors.error` — the same two tokens health-display.ts
          spends on `✓` and `✗`, so no hue is new to the row — each painted on
          sign and digits together, the shape git and GitHub already taught.
          No bold (the cursor's), no dim, no banding by magnitude: a colour
          that flips at 400 lines is a traffic light needing a legend, and width
          already carries size — `+2140 -388` is longer than `+6 -1` before
          anyone reads a digit.

          This cell was plain until 2026-09-11, on the argument that a hue per
          sign hands a colourblind reader two near-identical hues. That argument
          assumed colour was doing the discriminating. It is not: the `+`/`-`
          sign and the fixed `+`-first order are the channels, and colour only
          echoes them — the exact contract health-display.ts is built on, and
          the one it had been applying to every health glyph on the same row all
          along. Keep the signs; the colour is not licensed to replace them.
          Same treatment as the PR header's, one register down. One caveat, for
          the reader rather than the UI: GitHub counts lockfiles and generated
          files, so a six-line change that bumps `package-lock.json` reads as
          large. The number is honest about what the diff view will show; it is
          not a proxy for thought required. */}
      {sizeParts && !givingUp.size ? (
        <Text>
          {"  "}
          <Text color={colors.success}>{sizeParts.added}</Text>{" "}
          <Text color={colors.error}>{sizeParts.removed}</Text>
        </Text>
      ) : null}
      {/* Follows the turn arrow, because an unresolved thread is not by itself
          a claim on you: GitHub keeps a thread open until someone clicks
          Resolve conversation, so replying leaves the count exactly where it
          was. Loud while the other side spoke last, quiet once you have
          answered — otherwise this cell reads "your turn" in orange one column
          from the arrow reading "not your turn" in grey. Never dimmed on an
          unknown turn (no login, no lastActor): a count we cannot attribute is
          still worth seeing. */}
      {unresolvedLabel && !givingUp.threads ? (
        <Text
          bold={!spokeLast}
          color={spokeLast ? colors.secondary : colors.accent}
        >
          {"  " + unresolvedLabel}
        </Text>
      ) : null}
      {showAuthor && !givingUp.author ? (
        <Text dimColor italic>
          {"  by " + item.author}
        </Text>
      ) : null}
      {/* Age last, so every row ends on the date — a consistent right edge.
          Two tiers inside one cell, because the two halves are not equally
          worth reading: last-activity is the live fact you scan for, lifetime is
          background you consult. Painting both `dimColor` said "skip all of
          this" about the half you came here for. Last-activity takes
          `secondary` — the middle neutral the label cell already spends, no new
          token and no hue — and the parenthetical stays in the furniture tier.
          The parentheses carry the meaning on their own for a reader who sees no
          colour at all; the tier only reinforces them. */}
      {ageLabel && !givingUp.age ? (
        agePair ? (
          <>
            <Text color={colors.secondary}>{"  " + agePair.activity}</Text>
            <Text dimColor>{` (${agePair.lifetime})`}</Text>
          </>
        ) : (
          <Text color={colors.secondary}>{"  " + ageLabel}</Text>
        )
      ) : null}
      {/* Except for the three seconds a row is on its way out. */}
      {/* Suppressed behind an overlay — see the task row for why a pill cannot
          simply be recoloured with the rest of the backdrop. Suppressed in the
          render only: `pillCaps` above charges for it either way, because a row
          that reflowed as the overlay opened would move under the panel that
          just appeared over it. */}
      {backdropped
        ? null
        : announcements.map((a) => (
            <React.Fragment key={a.label}>
              <Text>{"  "}</Text>
              <Pill color={a.color}>{a.label}</Pill>
            </React.Fragment>
          ))}
      {/* See the ticket row: the refresh wording lives in the header now, not
          here, because here it costs columns the row does not have. MERGED above
          stays — it is your own action a second ago, on a row that is leaving
          anyway, so its reflow is both expected and brief. */}
    </Box>
  )
}
