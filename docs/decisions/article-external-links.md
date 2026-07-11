# External links in article bodies are `{offset,length,url}` spans, parallel to mentions

An external web link in a news body is stored the same way an `@`-mention is — an
`{ offset, length }` span over a text block's plain-text `text` — but carries a
`url` instead of an entity id and opens with `Linking.openURL` instead of
`router.push`. Only **custom-text** links are persisted; bare URLs are autolinked at
render and never stored.

## Problem

Article bodies supported only `@`-mentions of *internal* entities. There was no way
to link to anything external (a ticket page, a form, a source), and no rendering of
raw URLs. The feature had to add external links without a migration and without
disturbing the mention span machinery.

## Decision

- **Parallel `links` array, not a discriminated `NewsMention` union.** Text blocks
  gained `links: NewsLink[]` (`{ url, offset, length }`) and image blocks
  `captionLinks`, both `.default([])` — the same legacy-tolerant pattern as
  `content`/`coverImage`/`captionMentions`, so existing docs parse with no backfill.
  A discriminated union on a `kind` field was rejected: Zod can't default a
  discriminator, which would have forced migrating every stored mention object for
  no real gain (the two span kinds carry different payloads).
- **Only custom-text links are stored.** A skipped paste and a legacy post's URL
  take the identical path: render-time autolink of bare `http(s)` URLs
  (`buildLinkRuns`). Storing a span is reserved for the case autolink can't
  reconstruct — display text that differs from the URL. This keeps the `links` array
  minimal.
- **One offset math for both span kinds.** `adjustMentions` / `splitMentionsAtCaret`
  were generalized to `<T extends Span>` so links reuse the exact
  shift/rebase/drop-on-overlap logic mentions use — in edit, delete, image-split, and
  block-merge. Links and mentions cannot drift.
- **`isSafeHttpUrl` (http/https only) is the single security choke point.** It gates
  both link creation (the paste sheet) and every render-time `onPress`, and the
  schema regex rejects non-http(s) schemes — so a `javascript:`/`data:` URL can never
  reach `Linking.openURL`, even if hand-crafted into a stored span.
- **System browser now, not `expo-web-browser`.** On the web build (what ships
  first) both are identical; the in-app browser is a native-only benefit, deferred
  until native ships (an isolated one-function change in `RichText`).

## What this binds

- New rich-text-ish body features add spans parallel to mentions/links and reuse the
  generic `<T extends Span>` helpers — don't fork the offset math.
- Any new URL-opening path must go through `isSafeHttpUrl`; don't call
  `Linking.openURL` on author-supplied URLs directly.
- Don't persist bare URLs as link spans — autolink owns them.

## Revisit when

- Native apps are released → swap the external `onPress` to `expo-web-browser`'s
  `openBrowserAsync` (add the dependency + native rebuild).
- A body needs richer structure than offset/length spans (nested formatting,
  block-level links) — at that point the span model, not just this feature, is what's
  being reconsidered.
