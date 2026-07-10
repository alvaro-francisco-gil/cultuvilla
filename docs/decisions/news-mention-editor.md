# News `@`-mention editor: styled overlay over a transparent input, not a chip/rich-text editor

## Context

The news composer edits prose in a plain multiline React Native `TextInput`, with
`@`-mentions tracked as a parallel `NewsMention[]` span array (`offset`/`length`
into the block text) rather than as inline widgets. Styled, tappable rendering
happens only on the reader (`RichText`). Product wanted a picked reference to
*look* committed while editing (bare name, highlighted) and to delete as one unit,
and later wanted the same in image captions.

The hard constraint that shaped everything: **this app is web-first, and an
RN-Web `TextInput` is a plain `<textarea>`.** A textarea cannot render inline
styled runs and has no concept of an atomic, non-editable token. So "show the
reference highlighted" and "delete the whole reference at once" cannot come from
the input element itself.

## Decision

- **Styled overlay over a transparent input.** The `TextInput` renders with
  `color: 'transparent'` (caret kept via `cursorColor`/`selectionColor`); a
  scroll-synced absolutely-positioned `<Text>` mirrors the same characters with
  mention runs styled. The run-splitter is one shared, unit-tested helper
  (`mentionRuns`) used by both the editor overlay and the reader's `RichText`.
- **Mention runs are accent COLOUR at the same font weight** as the field
  (`text-accent underline`), never bold. Same glyph metrics ⇒ the overlay stays
  aligned with the invisible textarea caret. This is why the product ask for
  "bold" was delivered as colour: bold changes glyph widths and drifts the caret
  on web.
- **A picked reference drops the leading `@`** and commits as the bare label; the
  span covers just the label. The disappearing `@` is the "it worked" signal.
- **Atomic delete via `onKeyPress`.** Backspace at a span's trailing edge / Delete
  at its leading edge removes the whole span in one edit (`deleteMentionAt`);
  otherwise the keystroke falls through to the diff-based `adjustMentions`.
  `preventDefault` only fires on RN-Web (our target); on native the annotation
  still drops correctly, only the one-keystroke nicety may degrade.
- **Programmatic caret moves must notify the parent.** After a mention insert or
  atomic delete the field sets its caret with `setSelection`, but a scripted
  value+selection change does **not** reliably re-fire the native
  `onSelectionChange` on web. `MentionTextInput` therefore calls
  `onSelectionChange(cursor)` itself on those paths. Without this, `BlockEditor`'s
  tracked caret goes stale and an image insert splits the paragraph mid-reference.
- **Captions reuse the text-block mention model.** `NewsImageBlockSchema` carries
  `captionMentions: NewsMention[]` (offsets into `caption`), the caption editor is
  the same `MentionTextInput`, and the reader renders it through `RichText`.
  `captionMentions` is `.default([])` so image blocks written before it parse on
  read.

## Rejected alternatives

- **Chip/token composer** (real non-text chips in a flowing layout). Truest to
  "atomic + highlighted", but discards the single-`TextInput` model and the
  offset/length span data model, and is a large `BlockEditor` rewrite — too much
  surface for a lightweight mention feature.
- **Cross-platform rich-text library** (10tap / contentEditable). Native rich
  mentions out of the box, but a heavy dependency, a new data model, and web/native
  divergence risk.
- **Literal bold for the highlight.** Matches the original wording but breaks caret
  alignment on the web textarea (glyph-width mismatch against the overlay).

## What this binds

- Overlay mention runs must stay **the same font weight as the field**. Adding
  `font-medium`/bold (or any glyph-width-changing style) to the editor overlay
  reintroduces web caret drift. `underline` and colour are safe.
- Any code that programmatically changes the field's selection (new insert/delete
  affordances) must report the new caret via `onSelectionChange`, or downstream
  caret consumers (image-insert split point) will act on a stale offset.
- The editor never controls the `selection` prop continuously — a controlled
  selection on Android forces `NO_SUGGESTIONS` and drops the keyboard suggestion
  strip. Caret is only *predicted* on programmatic edits, never bound.
- Text blocks and image captions share the `NewsMention` shape and the
  `mentionRuns`/`insertMention`/`deleteMentionAt`/`adjustMentions` helpers — keep
  them block-kind-agnostic.

## Revisit when

- Native apps ship and the web textarea is no longer the primary target → the
  overlay hack could give way to native styled `TextInput` children (which work on
  iOS/Android but not RN-Web), or a real rich-text editor.
- Mentions need to survive glyph-width-changing styling (true bold) → the
  transparent-overlay approach no longer holds; move to a token/chip model.
