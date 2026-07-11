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
- **Omitir (skip) / empty display text:** do nothing to the model. The raw URL is
  already in the block `text`, and render-time autolink (below) makes it tappable.
  **No explicit span is stored.**
- **Guardar with custom text:** replace the URL substring in the block `text` with
  the custom text, and record a `NewsLink` span over the new text carrying the
  original URL. Shift any following mention/link spans by the length delta (reuse
  the generalized offset-shift logic).

**Consequence — stored `NewsLink` spans exist *only* for custom-text links.** Bare
URLs are never stored as spans; they are always resolved by autolink at render. This
keeps the `links` array minimal and means a skipped URL and a legacy post's URL take
the exact same (autolink) path.

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

## Resolved during planning

- **Helper naming:** keep `adjustMentions` / `splitMentionsAtCaret` names, widen their
  type parameter to `<T extends Span>`. Zero churn at existing mention call sites.
- **Autolink URL boundary:** match `https?://\S+`, then strip trailing punctuation
  (`. , ; : ! ? » " ' ’ ”`) and an unbalanced trailing `)`. Covered by tests.
- **Detection call site:** `MentionTextInput` owns `onChangeText`, so paste detection
  and the `LinkSheet` state live there. `BlockEditor`/`ImageBlock` just thread the
  extra `links` array through the widened `onChange`.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let article authors add tappable external web links — paste a URL, optionally give it custom display text — and render any bare URL in body text as a tappable link.

**Architecture:** An external link is an `{ offset, length, url }` span over a text block's plain-text `text`, stored in a new `links` array parallel to the existing `mentions`. Custom-text links are stored spans; bare URLs are resolved at render by autolink (never stored). Rendering merges mention + link + autolink runs; links open with `Linking.openURL` behind an http/https guard.

**Tech Stack:** Zod (shared models), React Native / Expo Router (mobile), NativeWind, vitest (`packages/shared`), jest + React Native Testing Library (`apps/mobile`).

## Global Constraints

- **Strict TypeScript, no `any`, no `@ts-nocheck`** — narrow `unknown` at boundaries.
- **`.default([])` for every new model array** — the strict Zod converter (`schema.parse` on read) throws on legacy docs missing the key. No migration; no `.optional()` left dangling.
- **No `firebase/*` imports in components/hooks** — model change lives in `packages/shared`; UI consumes it. (No new service is needed here — `content` is already threaded through `createNewsPost`/`updateNewsPost`.)
- **User-facing strings via `useT()`** — new sheet copy goes in `packages/i18n/messages/es.json`; no hardcoded Spanish.
- **`isSafeHttpUrl` is the single security choke point** — it gates both link creation and the render-time `onPress`. Scheme must be `http`/`https`.
- **Open with `Linking.openURL`** (system browser) — do NOT add `expo-web-browser` in this plan (native-only follow-up; would require a prebuild).
- Run `pnpm --filter @cultuvilla/shared test` (vitest) and `pnpm app:test` (jest) for the respective layers; `pnpm app:typecheck` for mobile types.

---

### Task 1: Model — `NewsLink` span + `links` / `captionLinks` arrays

**Files:**
- Modify: `packages/shared/src/models/news/NewsPostDataModel.ts`
- Test: `packages/shared/test/models/news/NewsPostDataModel.test.ts`

**Interfaces:**
- Produces: `NewsLinkSchema` / `NewsLink` (`{ url: string; offset: number; length: number }`); `NewsTextBlock` gains `links: NewsLink[]`; `NewsImageBlock` gains `captionLinks: NewsLink[]`.

- [ ] **Step 1: Write the failing tests**

Add to `NewsPostDataModel.test.ts`:

```ts
import { NewsTextBlockSchema, NewsLinkSchema } from '../../../src/models/news/NewsPostDataModel';

describe('NewsLinkSchema', () => {
  it('accepts a well-formed http(s) link span', () => {
    const link = { url: 'https://entradas.example.com', offset: 4, length: 6 };
    expect(NewsLinkSchema.parse(link)).toEqual(link);
  });

  it('rejects a non-URL string', () => {
    expect(() => NewsLinkSchema.parse({ url: 'not a url', offset: 0, length: 1 })).toThrow();
  });
});

describe('NewsTextBlockSchema links', () => {
  it('defaults links to [] for a legacy text block without the field', () => {
    const parsed = NewsTextBlockSchema.parse({ type: 'text', text: 'hola', mentions: [] });
    expect(parsed.links).toEqual([]);
  });

  it('keeps link spans when present', () => {
    const link = { url: 'https://x.com', offset: 0, length: 4 };
    const parsed = NewsTextBlockSchema.parse({ type: 'text', text: 'aquí', mentions: [], links: [link] });
    expect(parsed.links).toEqual([link]);
  });
});

describe('NewsImageBlockSchema captionLinks', () => {
  it('defaults captionLinks to [] for a legacy image block', () => {
    const parsed = NewsImageBlockSchema.parse({ type: 'image', storagePath: 'p/1', width: 10, height: 5, caption: 'x' });
    expect(parsed.captionLinks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared test -- NewsPostDataModel`
Expected: FAIL — `NewsLinkSchema` is not exported / `links` is undefined.

- [ ] **Step 3: Add the schema + fields**

In `NewsPostDataModel.ts`, after `NewsMentionSchema` (line ~59):

```ts
/**
 * An external web link span within a text block. `offset`/`length` locate the
 * display text in the block's `text`; `url` is the target. Stored ONLY for
 * custom-text links — bare URLs are autolinked at render, never persisted here.
 */
export const NewsLinkSchema = z.object({
  url: z.string().url(),
  offset: z.number(),
  length: z.number(),
});
export type NewsLink = z.infer<typeof NewsLinkSchema>;
```

Add `links` to `NewsTextBlockSchema`:

```ts
export const NewsTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  mentions: z.array(NewsMentionSchema),
  // `.default([])` keeps text blocks written before links existed parseable on
  // read (the converter runs schema.parse on every read).
  links: z.array(NewsLinkSchema).default([]),
});
```

Add `captionLinks` to `NewsImageBlockSchema` (next to `captionMentions`):

```ts
  captionLinks: z.array(NewsLinkSchema).default([]),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- NewsPostDataModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/news/NewsPostDataModel.ts packages/shared/test/models/news/NewsPostDataModel.test.ts
git commit -m "feat(shared): add NewsLink span + links/captionLinks to news blocks"
```

---

### Task 2: Generalize the offset helpers over any `{offset,length}` span

**Files:**
- Modify: `apps/mobile/lib/mentionText.ts`
- Test: `apps/mobile/lib/__tests__/mentionText.test.ts`

**Interfaces:**
- Produces: `Span` (`{ offset: number; length: number }`); `adjustMentions<T extends Span>(oldText, newText, spans: T[]): T[]`; `splitMentionsAtCaret<T extends Span>(spans: T[], caret): { before: T[]; after: T[] }`. Existing `NewsMention` call sites keep working unchanged (structural widening).

- [ ] **Step 1: Write the failing test (helpers operate on link-shaped spans)**

Add to `mentionText.test.ts`:

```ts
import type { NewsLink } from '@cultuvilla/shared/models/news/NewsPostDataModel';

function link(offset: number, length: number): NewsLink {
  return { url: 'https://x.com', offset, length };
}

describe('adjustMentions is generic over spans', () => {
  it('shifts a link span after an insertion, preserving url', () => {
    const out = adjustMentions('hello world', 'oh hello world', [link(6, 5)]);
    expect(out[0]).toEqual({ url: 'https://x.com', offset: 9, length: 5 });
  });
});

describe('splitMentionsAtCaret is generic over spans', () => {
  it('splits link spans at the caret and rebases the after side', () => {
    const { before, after } = splitMentionsAtCaret([link(0, 3), link(8, 4)], 5);
    expect(before).toEqual([link(0, 3)]);
    expect(after).toEqual([{ url: 'https://x.com', offset: 3, length: 4 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- mentionText`
Expected: FAIL — TypeScript rejects `NewsLink[]` where `NewsMention[]` is required (compile error surfaced by ts-jest), or the returned objects lose `url`.

- [ ] **Step 3: Widen the signatures**

In `mentionText.ts`, add the `Span` type near the top and widen the two helpers. Replace the `adjustMentions` and `splitMentionsAtCaret` signatures:

```ts
export interface Span {
  offset: number;
  length: number;
}

export function adjustMentions<T extends Span>(
  oldText: string,
  newText: string,
  spans: T[],
): T[] {
  if (oldText === newText) return spans;
  const prefix = commonPrefixLength(oldText, newText);
  const cap = Math.min(oldText.length, newText.length) - prefix;
  const suffix = commonSuffixLength(oldText, newText, Math.max(0, cap));
  const oldChangeEnd = oldText.length - suffix;
  const delta = newText.length - oldText.length;

  const result: T[] = [];
  for (const m of spans) {
    const end = m.offset + m.length;
    if (end <= prefix) {
      result.push(m);
    } else if (m.offset >= oldChangeEnd) {
      result.push({ ...m, offset: m.offset + delta });
    }
  }
  return result;
}

export function splitMentionsAtCaret<T extends Span>(
  spans: T[],
  caret: number,
): { before: T[]; after: T[] } {
  const before: T[] = [];
  const after: T[] = [];
  for (const m of spans) {
    const end = m.offset + m.length;
    if (end <= caret) before.push(m);
    else if (m.offset >= caret) after.push({ ...m, offset: m.offset - caret });
  }
  return { before, after };
}
```

(`deleteMentionAt` and `insertMention` stay `NewsMention`-specific — links have no atomic-delete or `@`-insert path.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm app:test -- mentionText`
Expected: PASS (both new and existing mention tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/mentionText.ts apps/mobile/lib/__tests__/mentionText.test.ts
git commit -m "refactor(mobile): make span offset helpers generic over {offset,length}"
```

---

### Task 3: `linkText.ts` — detection, autolink, safe-URL guard, run builder

**Files:**
- Create: `apps/mobile/lib/linkText.ts`
- Test: `apps/mobile/lib/__tests__/linkText.test.ts`

**Interfaces:**
- Consumes: `NewsMention`, `NewsLink` (shared model); `Span` (Task 2).
- Produces:
  - `isSafeHttpUrl(url: string): boolean`
  - `detectPastedUrl(oldText: string, newText: string): { url: string; offset: number; length: number } | null`
  - `applyCustomTextLink(text: string, mentions: NewsMention[], links: NewsLink[], detected: { url: string; offset: number; length: number }, displayText: string): { text: string; mentions: NewsMention[]; links: NewsLink[] }`
  - `buildLinkRuns(text: string, mentions: NewsMention[], links: NewsLink[]): LinkRun[]` where `LinkRun = { text: string; mention?: NewsMention; link?: NewsLink; autoUrl?: string }`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/__tests__/linkText.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { isSafeHttpUrl, detectPastedUrl, applyCustomTextLink, buildLinkRuns } from '../linkText';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

describe('isSafeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isSafeHttpUrl('http://x.com')).toBe(true);
    expect(isSafeHttpUrl('https://x.com')).toBe(true);
  });
  it('rejects other schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('ftp://x.com')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });
});

describe('detectPastedUrl', () => {
  it('detects a URL inserted as a multi-char chunk', () => {
    const out = detectPastedUrl('ver aquí ', 'ver aquí https://entradas.example.com');
    expect(out).toEqual({ url: 'https://entradas.example.com', offset: 9, length: 28 });
  });
  it('strips trailing punctuation from the detected URL', () => {
    const out = detectPastedUrl('', 'https://x.com.');
    expect(out).toEqual({ url: 'https://x.com', offset: 0, length: 13 });
  });
  it('returns null for a single typed character', () => {
    expect(detectPastedUrl('https://x.co', 'https://x.com')).toBeNull();
  });
  it('returns null when the inserted chunk has no URL', () => {
    expect(detectPastedUrl('hola', 'hola mundo')).toBeNull();
  });
});

describe('applyCustomTextLink', () => {
  it('replaces the URL with display text and records the link span', () => {
    const res = applyCustomTextLink('ver https://x.com ya', [], [],
      { url: 'https://x.com', offset: 4, length: 13 }, 'aquí');
    expect(res.text).toBe('ver aquí ya');
    expect(res.links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
  it('shifts a later mention span by the length delta', () => {
    const mention: NewsMention = { entityType: 'place', entityId: 'p', label: 'Plaza', offset: 18, length: 5 };
    const res = applyCustomTextLink('ver https://x.com en Plaza', [mention], [],
      { url: 'https://x.com', offset: 4, length: 13 }, 'aquí');
    // "https://x.com" (13) -> "aquí" (4): delta -9
    expect(res.mentions[0]!.offset).toBe(9);
  });
});

describe('buildLinkRuns', () => {
  it('autolinks a bare URL in plain text', () => {
    const runs = buildLinkRuns('ir a https://x.com hoy', [], []);
    expect(runs).toEqual([
      { text: 'ir a ' },
      { text: 'https://x.com', autoUrl: 'https://x.com' },
      { text: ' hoy' },
    ]);
  });
  it('renders a stored custom-text link run', () => {
    const link = { url: 'https://x.com', offset: 3, length: 4 };
    const runs = buildLinkRuns('ir aquí', [], [link]);
    expect(runs).toEqual([{ text: 'ir ' }, { text: 'aquí', link }]);
  });
  it('does not autolink a URL already inside a stored span', () => {
    const link = { url: 'https://real.com', offset: 0, length: 13 };
    const runs = buildLinkRuns('https://x.com', [], [link]);
    expect(runs).toEqual([{ text: 'https://x.com', link }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- linkText`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `linkText.ts`**

```ts
import type { NewsMention, NewsLink } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { adjustMentions, type Span } from './mentionText';

/** Trailing characters trimmed off an autodetected URL (sentence punctuation). */
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', '»', '"', "'", '’', '”']);

/** The single security choke point: only http/https URLs may ever be opened. */
export function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url);
}

function trimUrl(raw: string): string {
  let end = raw.length;
  while (end > 0 && TRAILING.has(raw[end - 1]!)) end--;
  // Drop a single unbalanced trailing ")" — common when a URL is wrapped in parens.
  if (raw[end - 1] === ')' && !raw.slice(0, end - 1).includes('(')) end--;
  return raw.slice(0, end);
}

const URL_RE = /https?:\/\/\S+/g;

/** All bare http(s) URLs in `text`, each already trimmed of trailing punctuation. */
function bareUrls(text: string): { url: string; offset: number; length: number }[] {
  const out: { url: string; offset: number; length: number }[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    if (url) out.push({ url, offset: m.index!, length: url.length });
  }
  return out;
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * When the last edit inserted a chunk (paste) containing a single http(s) URL,
 * return that URL and its position in `newText`. Null for single-char typing,
 * deletions, or chunks without a URL.
 */
export function detectPastedUrl(
  oldText: string,
  newText: string,
): { url: string; offset: number; length: number } | null {
  const delta = newText.length - oldText.length;
  if (delta <= 1) return null; // typing one char at a time never triggers the sheet
  const prefix = commonPrefixLength(oldText, newText);
  const inserted = newText.slice(prefix, prefix + delta);
  const found = bareUrls(inserted);
  if (found.length !== 1) return null;
  return { url: found[0]!.url, offset: prefix + found[0]!.offset, length: found[0]!.length };
}

/**
 * Replace the detected URL substring with `displayText` and record a link span
 * over it, shifting any following mention/link spans by the length delta.
 * Callers must pass a non-empty `displayText` (empty -> rely on autolink instead).
 */
export function applyCustomTextLink(
  text: string,
  mentions: NewsMention[],
  links: NewsLink[],
  detected: { url: string; offset: number; length: number },
  displayText: string,
): { text: string; mentions: NewsMention[]; links: NewsLink[] } {
  const { offset, length, url } = detected;
  const newText = text.slice(0, offset) + displayText + text.slice(offset + length);
  const shiftedMentions = adjustMentions(text, newText, mentions);
  const shiftedLinks = adjustMentions(text, newText, links);
  const span: NewsLink = { url, offset, length: displayText.length };
  return {
    text: newText,
    mentions: shiftedMentions,
    links: [...shiftedLinks, span].sort((a, b) => a.offset - b.offset),
  };
}

export interface LinkRun {
  text: string;
  mention?: NewsMention;
  link?: NewsLink;
  autoUrl?: string;
}

/**
 * Split `text` into ordered runs: mention spans, stored link spans, bare-URL
 * autolinks, and plain prose. Mentions and stored links are laid down first
 * (mentions win on overlap); autolinks fill only the still-plain gaps, so a URL
 * inside a stored span is never double-linked. Out-of-range / overlapping /
 * non-positive spans are skipped so a malformed block still renders.
 */
export function buildLinkRuns(text: string, mentions: NewsMention[], links: NewsLink[]): LinkRun[] {
  type Tagged = Span & { mention?: NewsMention; link?: NewsLink };
  const tagged: Tagged[] = [
    ...mentions.map((m) => ({ offset: m.offset, length: m.length, mention: m })),
    ...links.map((l) => ({ offset: l.offset, length: l.length, link: l })),
  ].sort((a, b) => a.offset - b.offset || (a.mention ? -1 : 1));

  const runs: LinkRun[] = [];
  let cursor = 0;
  const pushPlain = (from: number, to: number) => {
    if (to <= from) return;
    const slice = text.slice(from, to);
    let last = 0;
    for (const u of bareUrls(slice)) {
      if (u.offset > last) runs.push({ text: slice.slice(last, u.offset) });
      runs.push({ text: u.url, autoUrl: u.url });
      last = u.offset + u.length;
    }
    if (last < slice.length) runs.push({ text: slice.slice(last) });
  };

  for (const s of tagged) {
    if (s.offset < cursor || s.offset + s.length > text.length || s.length <= 0) continue;
    pushPlain(cursor, s.offset);
    runs.push({ text: text.slice(s.offset, s.offset + s.length), mention: s.mention, link: s.link });
    cursor = s.offset + s.length;
  }
  pushPlain(cursor, text.length);
  return runs;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm app:test -- linkText`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/linkText.ts apps/mobile/lib/__tests__/linkText.test.ts
git commit -m "feat(mobile): add link detection, autolink, and run-builder helpers"
```

---

### Task 4: Render links in `RichText` + thread through `NewsContentRenderer`

**Files:**
- Modify: `apps/mobile/components/feature/RichText.tsx`
- Modify: `apps/mobile/components/feature/NewsContentRenderer.tsx`
- Test: `apps/mobile/components/feature/__tests__/RichText.test.tsx` (create)

**Interfaces:**
- Consumes: `buildLinkRuns`, `isSafeHttpUrl` (Task 3); `mentionHref` (existing).
- Produces: `RichText` gains a `links?: NewsLink[]` prop (default `[]`). `NewsContentRenderer` passes `block.links` and `block.captionLinks`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/feature/__tests__/RichText.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { RichText } from '../RichText';

describe('RichText external links', () => {
  it('autolinks a bare URL and opens it with Linking.openURL', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText text="ir a https://x.com hoy" mentions={[]} links={[]} municipalityId="m1" />,
    );
    fireEvent.press(getByText('https://x.com'));
    expect(spy).toHaveBeenCalledWith('https://x.com');
    spy.mockRestore();
  });

  it('renders a custom-text link that opens its url', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText
        text="entradas aquí"
        mentions={[]}
        links={[{ url: 'https://tickets.example.com', offset: 9, length: 4 }]}
        municipalityId="m1"
      />,
    );
    fireEvent.press(getByText('aquí'));
    expect(spy).toHaveBeenCalledWith('https://tickets.example.com');
    spy.mockRestore();
  });

  it('does not make an unsafe-scheme span pressable', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByText } = render(
      <RichText
        text="click me"
        mentions={[]}
        links={[{ url: 'javascript:alert(1)', offset: 0, length: 8 }]}
        municipalityId="m1"
      />,
    );
    fireEvent.press(getByText('click me'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- RichText`
Expected: FAIL — `RichText` has no `links` prop / no link rendering.

- [ ] **Step 3: Rewrite `RichText` to render merged runs**

Replace the body of `RichText.tsx`:

```tsx
import { Fragment } from 'react';
import { Text as RNText, Linking } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../primitives';
import type { TextProps } from '../primitives/Text';
import { mentionHref } from '../../lib/newsMentions';
import { buildLinkRuns, isSafeHttpUrl } from '../../lib/linkText';
import type { NewsMention, NewsLink } from '@cultuvilla/shared/models/news/NewsPostDataModel';

interface RichTextProps extends Omit<TextProps, 'children'> {
  text: string;
  mentions: NewsMention[];
  /** Stored custom-text external links indexing into `text`. */
  links?: NewsLink[];
  municipalityId: string;
}

const LINK_CLASS = 'text-accent font-medium underline';

function openExternal(url: string) {
  if (isSafeHttpUrl(url)) void Linking.openURL(url);
}

/**
 * Render a text block with its inline `@`-mentions (in-app navigation) and
 * external links — both stored custom-text links and bare URLs autolinked at
 * render — styled and tappable. Unsafe-scheme URLs render as plain text.
 */
export function RichText({ text, mentions, links = [], municipalityId, ...textProps }: RichTextProps) {
  const runs = buildLinkRuns(text, mentions, links);
  if (runs.length === 1 && !runs[0]!.mention && !runs[0]!.link && !runs[0]!.autoUrl) {
    return <Text {...textProps}>{text}</Text>;
  }

  const parts = runs.map((run, i) => {
    if (run.mention) {
      const href = mentionHref(run.mention, municipalityId);
      return (
        <RNText
          key={i}
          className={LINK_CLASS}
          onPress={href ? () => router.push(href as never) : undefined}
        >
          {run.text}
        </RNText>
      );
    }
    const url = run.link?.url ?? run.autoUrl;
    if (url) {
      return (
        <RNText
          key={i}
          className={LINK_CLASS}
          onPress={isSafeHttpUrl(url) ? () => openExternal(url) : undefined}
        >
          {run.text}
        </RNText>
      );
    }
    return <Fragment key={i}>{run.text}</Fragment>;
  });

  return <Text {...textProps}>{parts}</Text>;
}
```

- [ ] **Step 4: Thread `links` through `NewsContentRenderer`**

In `NewsContentRenderer.tsx`, pass the new arrays. Text block:

```tsx
<RichText
  key={i}
  text={block.text}
  mentions={block.mentions}
  links={block.links}
  municipalityId={municipalityId}
/>
```

Image caption (in `InlineImage`):

```tsx
<RichText
  text={block.caption}
  mentions={block.captionMentions}
  links={block.captionLinks}
  municipalityId={municipalityId}
  tone="muted"
  variant="caption"
  className="text-center"
/>
```

(The `body`-fallback path — `<Text>{body}</Text>` when `content` is empty — can stay, but to autolink legacy bodies replace it with `<RichText text={body} mentions={[]} links={[]} municipalityId={municipalityId} />`.)

- [ ] **Step 5: Run to verify it passes + typecheck**

Run: `pnpm app:test -- RichText && pnpm app:typecheck`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/RichText.tsx apps/mobile/components/feature/NewsContentRenderer.tsx apps/mobile/components/feature/__tests__/RichText.test.tsx
git commit -m "feat(mobile): render external + autolinked URLs in article bodies"
```

---

### Task 5: `LinkSheet` + i18n strings

**Files:**
- Create: `apps/mobile/components/feature/LinkSheet.tsx`
- Modify: `packages/i18n/messages/es.json`
- Test: `apps/mobile/components/feature/__tests__/LinkSheet.test.tsx` (create)

**Interfaces:**
- Produces: `LinkSheet` component:
  ```ts
  interface LinkSheetProps {
    url: string | null;            // non-null => visible
    onSave: (displayText: string) => void; // empty string allowed = "just autolink"
    onDismiss: () => void;
  }
  ```

- [ ] **Step 1: Add i18n strings**

In `packages/i18n/messages/es.json`, under the `news` object add a `linkSheet` block (place near the existing `news.compose` group; match surrounding nesting):

```json
"linkSheet": {
  "title": "Añadir enlace",
  "urlLabel": "Enlace detectado",
  "textLabel": "Texto a mostrar (opcional)",
  "textPlaceholder": "p. ej. compra tus entradas",
  "save": "Guardar",
  "skip": "Omitir"
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/components/feature/__tests__/LinkSheet.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { LinkSheet } from '../LinkSheet';

describe('LinkSheet', () => {
  it('is not rendered when url is null', () => {
    const { queryByText } = render(<LinkSheet url={null} onSave={jest.fn()} onDismiss={jest.fn()} />);
    expect(queryByText('Añadir enlace')).toBeNull();
  });

  it('returns the typed display text on save', () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <LinkSheet url="https://x.com" onSave={onSave} onDismiss={jest.fn()} />,
    );
    fireEvent.changeText(getByPlaceholderText('p. ej. compra tus entradas'), 'aquí');
    fireEvent.press(getByText('Guardar'));
    expect(onSave).toHaveBeenCalledWith('aquí');
  });

  it('calls onDismiss on skip', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(<LinkSheet url="https://x.com" onSave={jest.fn()} onDismiss={onDismiss} />);
    fireEvent.press(getByText('Omitir'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm app:test -- LinkSheet`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `LinkSheet.tsx`**

Compose primitives; a lightweight inline sheet (avoid RN `Modal` per mobile-web-compat). Reset local state when `url` changes.

```tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Text, VStack } from '../primitives';
import { useT } from '../../lib/i18n';

interface LinkSheetProps {
  /** The detected URL; non-null makes the sheet visible. */
  url: string | null;
  /** Called with the display text (empty string = keep as autolinked raw URL). */
  onSave: (displayText: string) => void;
  onDismiss: () => void;
}

export function LinkSheet({ url, onSave, onDismiss }: LinkSheetProps) {
  const { t } = useT();
  const [text, setText] = useState('');

  useEffect(() => {
    if (url) setText('');
  }, [url]);

  if (!url) return null;

  return (
    <View className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-subtle bg-surface-elevated p-4">
      <VStack gap={3}>
        <Text variant="bodyLg" className="font-semibold">
          {t('news.linkSheet.title')}
        </Text>
        <VStack gap={1}>
          <Text variant="caption" tone="muted">
            {t('news.linkSheet.urlLabel')}
          </Text>
          <Text numberOfLines={1} className="text-accent">
            {url}
          </Text>
        </VStack>
        <VStack gap={1}>
          <Text variant="caption" tone="muted">
            {t('news.linkSheet.textLabel')}
          </Text>
          <Input
            value={text}
            onChangeText={setText}
            placeholder={t('news.linkSheet.textPlaceholder')}
            autoFocus
          />
        </VStack>
        <View className="flex-row justify-end gap-2">
          <Button variant="ghost" onPress={onDismiss}>
            {t('news.linkSheet.skip')}
          </Button>
          <Button onPress={() => onSave(text.trim())}>{t('news.linkSheet.save')}</Button>
        </View>
      </VStack>
    </View>
  );
}
```

> If the `Input`/`Button` prop shapes differ from the above (check `apps/mobile/components/primitives/`), adapt the props but keep the `onSave(text.trim())` / `onDismiss` contract and the `t()` keys.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm app:test -- LinkSheet`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/LinkSheet.tsx apps/mobile/components/feature/__tests__/LinkSheet.test.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): add LinkSheet for optional custom link text"
```

---

### Task 6: Wire detection + sheet into `MentionTextInput`

**Files:**
- Modify: `apps/mobile/components/feature/MentionTextInput.tsx`
- Test: `apps/mobile/components/feature/__tests__/MentionTextInput.test.tsx` (create)

**Interfaces:**
- Consumes: `detectPastedUrl`, `applyCustomTextLink`, `buildLinkRuns`, `isSafeHttpUrl` (Task 3); `adjustMentions` (Task 2); `LinkSheet` (Task 5).
- Produces: `MentionTextInput` gains `links: NewsLink[]` prop and its `onChange` signature widens to `(text: string, mentions: NewsMention[], links: NewsLink[]) => void`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/feature/__tests__/MentionTextInput.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { MentionTextInput } from '../MentionTextInput';

const noopCandidates: never[] = [];

describe('MentionTextInput link paste', () => {
  it('opens the link sheet when a URL is pasted and stores a custom-text link on save', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <MentionTextInput
        value="ver "
        mentions={[]}
        links={[]}
        candidates={noopCandidates}
        placeholder="Escribe…"
        onChange={onChange}
      />,
    );
    // Simulate a paste: the value jumps by a multi-char URL chunk.
    fireEvent.changeText(getByPlaceholderText('Escribe…'), 'ver https://x.com');
    // Sheet appears; type display text and save.
    fireEvent.changeText(getByPlaceholderText('p. ej. compra tus entradas'), 'aquí');
    fireEvent.press(getByText('Guardar'));

    const [text, , links] = onChange.mock.calls.at(-1)!;
    expect(text).toBe('ver aquí');
    expect(links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- MentionTextInput`
Expected: FAIL — no `links` prop / no sheet.

- [ ] **Step 3: Wire it up**

In `MentionTextInput.tsx`:

1. Widen the props:

```tsx
import type { NewsMention, NewsLink, MentionEntityType } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { detectPastedUrl, applyCustomTextLink, buildLinkRuns, isSafeHttpUrl } from '../../lib/linkText';
import { LinkSheet } from './LinkSheet';

interface MentionTextInputProps {
  value: string;
  mentions: NewsMention[];
  links: NewsLink[];
  onChange: (text: string, mentions: NewsMention[], links: NewsLink[]) => void;
  candidates: MentionCandidate[];
  placeholder?: string;
  onFocus?: () => void;
  onSelectionChange?: (caret: number) => void;
}
```

2. Track a pending detection and replace `handleChangeText`:

```tsx
const [pendingUrl, setPendingUrl] = useState<{ url: string; offset: number; length: number } | null>(null);
```

```tsx
function handleChangeText(next: string) {
  const nextMentions = adjustMentions(value, next, mentions);
  const nextLinks = adjustMentions(value, next, links);
  onChange(next, nextMentions, nextLinks);
  const detected = detectPastedUrl(value, next);
  if (detected && isSafeHttpUrl(detected.url)) setPendingUrl(detected);
}
```

3. Update the overlay runs to style links + autolinks (use `buildLinkRuns` instead of `mentionRuns`):

```tsx
const runs = useMemo(() => buildLinkRuns(value, mentions, links), [value, mentions, links]);
```
```tsx
{runs.map((run, i) =>
  run.mention || run.link || run.autoUrl ? (
    <Text key={i} className="text-accent underline">{run.text}</Text>
  ) : (
    <Text key={i} className="text-primary">{run.text}</Text>
  ),
)}
```

4. In `handleKeyPress` / `pick`, `onChange` now needs the third arg — pass the current `links` through unchanged (deletes/inserts touch only mentions and text): `onChange(res.text, res.mentions, adjustMentions(value, res.text, links))` for the delete path, and `onChange(res.text, res.mentions, links)` for `pick` (a mention insert shifts links after the insert point — use `adjustMentions(value, res.text, links)` there too).

5. Render the sheet at the end of the returned tree and apply on save:

```tsx
<LinkSheet
  url={pendingUrl?.url ?? null}
  onDismiss={() => setPendingUrl(null)}
  onSave={(displayText) => {
    if (pendingUrl && displayText) {
      const res = applyCustomTextLink(value, mentions, links, pendingUrl, displayText);
      onChange(res.text, res.mentions, res.links);
    }
    setPendingUrl(null);
  }}
/>
```

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `pnpm app:test -- MentionTextInput && pnpm app:typecheck`
Expected: `MentionTextInput` PASS. Typecheck FAILS at `BlockEditor` call sites (missing `links` / new `onChange` arity) — that is Task 7. It's OK to commit this task with the known downstream type break, since Task 7 immediately follows; note it in the commit body.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/MentionTextInput.tsx apps/mobile/components/feature/__tests__/MentionTextInput.test.tsx
git commit -m "feat(mobile): detect pasted URLs in MentionTextInput and offer link sheet

BlockEditor call sites are updated in the next commit (widened onChange arity)."
```

---

### Task 7: Thread `links` through `BlockEditor` and the save path

**Files:**
- Modify: `apps/mobile/components/feature/BlockEditor.tsx`
- Modify: `apps/mobile/app/news/new.tsx`
- Test: `apps/mobile/components/feature/__tests__/BlockEditor.test.tsx` (create — covers the pure `removeImage` merge for links)

**Interfaces:**
- Consumes: widened `MentionTextInput` (Task 6); generalized `splitMentionsAtCaret` (Task 2).
- Produces: `EditorTextBlock` gains `links: NewsLink[]`; `EditorImageBlock` gains `captionLinks: NewsLink[]`; `emptyTextBlock()` seeds `links: []`; content assembly in `new.tsx` writes `links` / `captionLinks` onto the `NewsBlock`s.

- [ ] **Step 1: Extend the editor block types + `emptyTextBlock`**

In `BlockEditor.tsx`:

```tsx
export type EditorTextBlock = {
  id: string;
  type: 'text';
  text: string;
  mentions: NewsMention[];
  links: NewsLink[];
};
export type EditorImageBlock = {
  // …existing fields…
  captionMentions: NewsMention[];
  captionLinks: NewsLink[];
};
```
```tsx
export function emptyTextBlock(): EditorTextBlock {
  return { id: newBlockId(), type: 'text', text: '', mentions: [], links: [] };
}
```
Import `NewsLink`:
```tsx
import type { NewsMention, NewsLink } from '@cultuvilla/shared/models/news/NewsPostDataModel';
```

- [ ] **Step 2: Update the text-block `MentionTextInput` usage + caption usage**

Text block (in the `blocks.map`):
```tsx
<MentionTextInput
  key={block.id}
  value={block.text}
  mentions={block.mentions}
  links={block.links}
  candidates={candidates}
  placeholder={t('news.compose.block.textPlaceholder')}
  onChange={(text, mentions, links) => updateBlock(block.id, { text, mentions, links })}
  onFocus={() => { active.current = { id: block.id, caret: block.text.length }; }}
  onSelectionChange={(caret) => { if (active.current.id === block.id) active.current.caret = caret; }}
/>
```
Caption `MentionTextInput` (in `ImageBlock`) — widen `onCaption`:
```tsx
onCaption: (caption: string, captionMentions: NewsMention[], captionLinks: NewsLink[]) => void;
```
```tsx
<MentionTextInput
  value={block.caption}
  mentions={block.captionMentions}
  links={block.captionLinks}
  candidates={candidates}
  placeholder={captionPlaceholder}
  onChange={onCaption}
/>
```
And its call site:
```tsx
onCaption={(caption, captionMentions, captionLinks) =>
  updateBlock(block.id, { caption, captionMentions, captionLinks })}
```

- [ ] **Step 3: Split & merge links alongside mentions**

In `addImageAtCaret`, split the block's `links` at the caret and seed both new blocks:
```tsx
const { before, after } = splitMentionsAtCaret(target.mentions, caret);
const { before: linksBefore, after: linksAfter } = splitMentionsAtCaret(target.links, caret);
const beforeBlock: EditorTextBlock = {
  id: target.id, type: 'text',
  text: target.text.slice(0, caret), mentions: before, links: linksBefore,
};
const afterBlock: EditorTextBlock = {
  id: newBlockId(), type: 'text',
  text: target.text.slice(caret), mentions: after, links: linksAfter,
};
```
Also seed the "no focused paragraph" append path — `emptyTextBlock()` already carries `links: []`, so no change there.

In `removeImage`, carry links across the merge (rebasing the `next` block's link offsets exactly like mentions):
```tsx
const merged: EditorTextBlock = {
  id: prev.id, type: 'text',
  text: prev.text + sep + next.text,
  mentions: [...prev.mentions, ...next.mentions.map((m) => ({ ...m, offset: m.offset + shift }))],
  links: [...prev.links, ...next.links.map((l) => ({ ...l, offset: l.offset + shift }))],
};
```

- [ ] **Step 4: Write the failing test for the merge**

Create `apps/mobile/components/feature/__tests__/BlockEditor.test.tsx` — exercise `removeImage` via the rendered component (render three blocks: text, image, text; press the image's remove control; assert merged block via `onChange`). Minimal shape:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { BlockEditor, type EditorBlock } from '../BlockEditor';

it('merges links across a removed image, rebasing the trailing block offsets', () => {
  const blocks: EditorBlock[] = [
    { id: 't1', type: 'text', text: 'antes', mentions: [], links: [{ url: 'https://a.com', offset: 0, length: 5 }] },
    { id: 'i1', type: 'image', storagePath: 'p/1', blob: null, uri: null, width: 10, height: 10, caption: '', captionMentions: [], captionLinks: [] },
    { id: 't2', type: 'text', text: 'después', mentions: [], links: [{ url: 'https://b.com', offset: 0, length: 7 }] },
  ];
  const onChange = jest.fn();
  const { getByLabelText } = render(<BlockEditor blocks={blocks} onChange={onChange} candidates={[]} />);
  fireEvent.press(getByLabelText('news.compose.block.removeImage')); // remove label via mocked t()
  const merged = onChange.mock.calls.at(-1)![0][0];
  expect(merged.text).toBe('antes\n\ndespués');
  expect(merged.links).toEqual([
    { url: 'https://a.com', offset: 0, length: 5 },
    { url: 'https://b.com', offset: 7, length: 7 }, // shifted by "antes\n\n"
  ]);
});
```

> If the test harness renders `t()` keys verbatim (common in this repo's jest setup — check `apps/mobile`'s test i18n mock), `getByLabelText('news.compose.block.removeImage')` works; otherwise use the resolved Spanish label. Adjust to match the existing mock used by `EventAttendees.test.tsx`.

- [ ] **Step 5: Update the save/assembly path in `news/new.tsx`**

In the content-assembly loop (~line 282), write `links`:
```tsx
content.push({ type: 'text', text: block.text, mentions: block.mentions, links: block.links });
```
And for image blocks (~line 294):
```tsx
content.push({
  type: 'image',
  storagePath,
  width: block.width,
  height: block.height,
  caption: block.caption.trim() || null,
  captionMentions: block.captionMentions,
  captionLinks: block.captionLinks,
});
```
Also find where the screen builds `EditorBlock`s from a loaded post (edit mode prefill) and seed `links` / `captionLinks` from `block.links` / `block.captionLinks` (they default to `[]` via the schema, so a loaded legacy post is safe).

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm app:test -- BlockEditor && pnpm app:typecheck`
Expected: PASS; typecheck clean (the Task 6 downstream break is now resolved).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/feature/BlockEditor.tsx apps/mobile/app/news/new.tsx apps/mobile/components/feature/__tests__/BlockEditor.test.tsx
git commit -m "feat(mobile): thread external links through the block editor and save path"
```

---

### Task 8: Full-gate verification + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a CHANGELOG entry** under `## [Unreleased]`:

```markdown
- **Article external links.** Authors can paste a web link into an article body and optionally give it custom display text; bare URLs render as tappable links. Links open in the system browser.
```

- [ ] **Step 2: Run the full gate**

Run: `pnpm app:test && pnpm app:typecheck && pnpm --filter @cultuvilla/shared test`
Expected: all PASS.

- [ ] **Step 3: Manual smoke (drive the app — use the `verify` / `drive-android-avd` skill or the web build)**
  - Compose an article, paste `https://…` → sheet appears → save with custom text → renders as a tappable styled link that opens the browser.
  - Paste a URL and skip → the raw URL renders tappable (autolink).
  - Type a bare URL by hand → renders tappable on the detail screen.
  - Open an existing (legacy) article containing a URL in its body → URL is tappable.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note article external links"
```

---

## Self-review notes

- **Spec coverage:** external URLs (Tasks 3–4), custom display text (Tasks 3, 5–7), autolink of bare/typed/legacy URLs (Task 3 `buildLinkRuns` + Task 4 fallback), paste→sheet flow (Tasks 5–6), system-browser open + safe-scheme guard (Task 4), i18n (Task 5), model back-compat (Task 1). ✅
- **`expo-web-browser` follow-up** is intentionally out of scope (recorded in the design section).
- **Known interim type break** at the end of Task 6 is expected and closed by Task 7 — do not treat it as a regression.
- **Harness adaptation flagged twice** (i18n mock label resolution in Tasks 6–7) — confirm against the existing `EventAttendees.test.tsx` mock before writing those component tests.
