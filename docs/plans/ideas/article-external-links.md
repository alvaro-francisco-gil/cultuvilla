# Article external links

## Goal

Let authors put tappable external web links into a news article body — paste a URL, optionally give it custom display text — and render any bare URL in body text as a tappable link.

## Context

News post bodies are stored as an ordered block array (`content: NewsBlock[]`) of
text and image blocks, plus a flattened plain-text `body` mirror for legacy
readers/search/previews. The only inline richness today is `@`-mentions of
*internal* entities: offset/length spans (`NewsMention`) into a block's plain-text
`text`, rendered by `RichText` (accent + underline) and navigated with
`router.push`. See:

- Model: [packages/shared/src/models/news/NewsPostDataModel.ts](../../../packages/shared/src/models/news/NewsPostDataModel.ts)
- Span helpers (pure): [apps/mobile/lib/mentionText.ts](../../../apps/mobile/lib/mentionText.ts)
- Renderer: [apps/mobile/components/feature/RichText.tsx](../../../apps/mobile/components/feature/RichText.tsx)
- Mention → route: [apps/mobile/lib/newsMentions.ts](../../../apps/mobile/lib/newsMentions.ts)
- Editor: [apps/mobile/components/feature/BlockEditor.tsx](../../../apps/mobile/components/feature/BlockEditor.tsx)
- Text input: [apps/mobile/components/feature/MentionTextInput.tsx](../../../apps/mobile/components/feature/MentionTextInput.tsx)

There is currently **no way to add an external URL** to a body: no markdown, no
autolink, no `Linking.openURL` in the news path. `MENTION_ENTITY_TYPES` is
internal-only. This plan adds external links without disturbing the mention system.

## Design / approach

External links reuse the existing span model: a link is an `{ offset, length }`
span over a block's plain-text `text`, exactly like a mention, but it carries a
`url` instead of an entity id and opens with the system browser instead of
`router.push`.

### Data model — parallel `links` array (chosen over a discriminated union)

Add a `links: NewsLink[]` array to text blocks and image blocks (for caption
links), alongside the existing `mentions`, defaulted with `.default([])`.

```ts
export const NewsLinkSchema = z.object({
  url: z.string().url(),
  offset: z.number(),
  length: z.number(),
});
export type NewsLink = z.infer<typeof NewsLinkSchema>;
```

- `NewsTextBlockSchema` gains `links: z.array(NewsLinkSchema).default([])`.
- `NewsImageBlockSchema` gains `captionLinks: z.array(NewsLinkSchema).default([])`
  (mirrors `captionMentions`).

`.default([])` is the same legacy back-compat pattern already used for `content`,
`coverImage`, and `captionMentions`: the strict converter runs `schema.parse()` on
every read, so existing news docs (which have no `links` key) parse fine and get an
empty array. **No backfill or migration of existing docs is required** — this is
the reason for choosing a parallel array over folding links into `NewsMention` as a
discriminated union (a discriminated union's `kind` discriminator can't be
defaulted in Zod, forcing a migration of every stored mention object for no real
gain, since the two span kinds carry different payloads).

`buildNewsPostData` / `NewsPostDataInput` need no change (blocks are passed through
in `content`). The flattened `body` string is unaffected: a link's display text
already lives in the block `text`, so `flattenBody` keeps working unchanged.

### Span helpers — generalize, don't duplicate

`adjustMentions`, `splitMentionsAtCaret`, and `deleteMentionAt` in `mentionText.ts`
already operate purely on `{ offset, length }`. Generalize their signatures to
`<T extends { offset: number; length: number }>` so the same functions maintain the
`links` array as text is edited (rename left as-is or to neutral `adjustSpans` etc.
— decide during implementation; keep the public mention names if churn isn't worth
it). This is a targeted improvement to code we're already editing, per AGENTS.md.

Add a **URL detection** helper (new, pure, jest-tested), living in a mobile lib
(e.g. `apps/mobile/lib/linkText.ts`):

- `detectPastedUrl(oldText, newText): { url: string; offset: number; length: number } | null`
  — diff `oldText`→`newText` to isolate the inserted chunk; if that chunk contains a
  single `http(s)://` URL token, return its url + its position in `newText`. Returns
  `null` for multi-char edits that aren't a URL, or single-char typing (delta of 1).
- `httpUrlRegex` / `findBareUrls(text, spans): { url, offset, length }[]` — locate
  bare `http(s)` URLs in `text` that are **not already covered by** a mention or
  link span (used by the render-time autolink).
- `isSafeHttpUrl(url): boolean` — scheme is `http`/`https` only (reject
  `javascript:`, `data:`, etc.) — used to guard `Linking.openURL`.

### Authoring flow (paste → detect → optional custom text)

In `BlockEditor` / `MentionTextInput`'s `onChangeText`, after the existing
`adjustMentions` bookkeeping, run `detectPastedUrl(old, new)`. On a hit, open a
new **link sheet** (`apps/mobile/components/feature/LinkSheet.tsx`, a bottom sheet
matching existing sheet primitives):

- Shows the detected URL (read-only) and an optional **display text** input, with
  **Guardar** / **Omitir** actions.
- **Omitir (skip):** keep the raw URL text as-is; record a `NewsLink` span over the
  URL's `[offset, length]`. URL stays visible and becomes tappable.
- **Guardar with custom text:** replace the URL substring in the block `text` with
  the custom text, and record a `NewsLink` span over the new text carrying the
  original URL. Shift any following mention/link spans by the length delta (reuse
  the generalized offset-shift logic).

Editing/deleting a link span reuses the generalized helpers, so backspacing across
a link and shifting spans already work.

### Rendering (`RichText`)

- Merge `mentions` + `links` into one ordered run list (extend `mentionRuns`, or add
  a `spanRuns` that takes both; a run is tagged as `mention` | `link` | plain).
- **Link run:** render accent + underline; `onPress` calls `Linking.openURL(url)`
  **only if `isSafeHttpUrl(url)`** (otherwise render as plain, non-tappable text).
- **Mention run:** unchanged (`router.push`).
- **Autolink:** for each plain-prose run, run `findBareUrls` and split it further so
  bare `http(s)` URLs render as tappable links too. This covers typed-out URLs (that
  never hit the paste sheet) and the legacy `body`-string fallback path
  (`NewsContentRenderer` renders `body` as a single text block when `content` is
  empty — autolink makes old posts' URLs live with no migration).

`RichText` must accept `links` as a new prop; `NewsContentRenderer` passes
`block.links` (and `captionLinks` for image captions). The `body`-fallback render
path passes empty span arrays but still benefits from autolink.

### Open behavior — system browser now, in-app browser later

Open external links with `Linking.openURL` (system browser). On the web build —
which is what ships first (native apps are built but not released, per AGENTS.md) —
this opens a new tab, **identical** to what `expo-web-browser` would do, so the
in-app-browser advantage is a native-only benefit that doesn't apply pre-release.
`Linking` adds no dependency and needs no native prebuild.

**Follow-up (not now):** when the native apps ship, swap the link `onPress` to
`expo-web-browser`'s `openBrowserAsync` for the nicer in-app browser
(Custom Tabs / `SFSafariViewController`). It's a one-function change isolated to
`RichText`; it will require adding the `expo-web-browser` dependency and a native
rebuild (see the `expo-native-rebuild` skill).

### i18n

Add link-sheet strings under a `news`/`linkSheet` namespace in
[packages/i18n/messages/es.json](../../../packages/i18n/messages/es.json), consumed
via `useT()`: sheet title, URL label, display-text placeholder, Guardar, Omitir.

### Security note

Arbitrary author-supplied URLs are opened with `Linking.openURL`. The
`isSafeHttpUrl` guard (http/https only) is the single choke point — it must gate
both the paste-sheet acceptance and the render-time `onPress`, so a stored span with
a `javascript:`/`data:` URL (or a malformed one) can never be dialed.

## File Structure

- **Modify** `packages/shared/src/models/news/NewsPostDataModel.ts` — `NewsLinkSchema`, `links`, `captionLinks`.
- **Modify** `apps/mobile/lib/mentionText.ts` — generalize offset helpers over `{offset,length}`.
- **Create** `apps/mobile/lib/linkText.ts` — `detectPastedUrl`, `findBareUrls`, `isSafeHttpUrl`.
- **Modify** `apps/mobile/components/feature/RichText.tsx` — merged span runs + autolink + safe `Linking.openURL`.
- **Modify** `apps/mobile/components/feature/NewsContentRenderer.tsx` — pass `links` / `captionLinks`.
- **Create** `apps/mobile/components/feature/LinkSheet.tsx` — paste-detected link sheet.
- **Modify** `apps/mobile/components/feature/BlockEditor.tsx` / `MentionTextInput.tsx` — invoke detection + sheet on change.
- **Modify** `packages/i18n/messages/es.json` — sheet strings.
- **Tests:** vitest for the model (`packages/shared/test/`); jest for `linkText` + generalized helpers + `RichText` span merging (`apps/mobile/**/__tests__/`).

## Open questions

- **Helper naming:** generalize in place (keep `adjustMentions` name, widen type) vs.
  rename to neutral `adjustSpans`/`splitSpansAtCaret`. Lean: keep names to avoid churn
  unless a rename reads clearly better once both call sites exist.
- **Autolink URL boundary:** trailing punctuation handling (`(https://x.com).`) — a
  known linkify edge case. Pick a pragmatic regex and cover it with tests; not a
  blocker.
- **Where detection fires:** `BlockEditor` vs. inside `MentionTextInput`. Confirm
  which owns `onChangeText` and can host the sheet trigger during implementation.
