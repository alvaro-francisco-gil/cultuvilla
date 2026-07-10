# News mention editor: highlighted references + atomic delete

## Goal

When composing a news article, a reference picked from the `@`-autocomplete should read as a *committed* reference — shown as the bare name in the brand accent colour (no literal `@`) — and Backspace/Delete at its edge should remove the whole reference in one keystroke, not character by character.

## Context

The content editor ([apps/mobile/components/feature/MentionTextInput.tsx](../../../apps/mobile/components/feature/MentionTextInput.tsx)) is a plain multiline RN `TextInput`. Mentions are not inline widgets: the field renders literal text `@Label`, and a parallel `NewsMention[]` array records `{ entityType, entityId, label, offset, length }` spans (the span currently *includes* the leading `@`). Styled/tappable rendering only happens on the reader ([NewsContentRenderer.tsx](../../../apps/mobile/components/feature/NewsContentRenderer.tsx)). All span math is pure and unit-tested in [apps/mobile/lib/mentionText.ts](../../../apps/mobile/lib/mentionText.ts).

Two friction points today:
1. A picked reference looks identical to prose (`@Name`) — no signal it "took".
2. Deleting a reference is diff-based: backspacing into it silently drops the annotation but leaves the characters, deleting one letter at a time.

**Hard constraint — web-first.** RN-Web is the only shipped UI and an RN `TextInput` there is a plain `<textarea>`: it cannot render styled text inline and has no "atomic token" concept. So both asks require changing the editing model in `MentionTextInput`, not just the pure helpers.

## Design / approach

**Chosen technique: styled overlay (rejected alternatives below).** Keep the existing data model, `NewsBlock` structure, and reader renderer untouched in shape; confine the change to `MentionTextInput` + `mentionText.ts` + a dev backfill.

### 1. Drop the leading `@` on insert

`insertMention` replaces the active `@query` with `{label}` (bare, no `@`) plus the trailing space; the recorded span covers just the label. This is the clearest "it worked" signal — the `@` vanishes the instant you pick.

Touch points:
- `insertMention` in `mentionText.ts` (`labelText = candidate.label`, adjust `consumedLen`/`insertedLen`/`length`).
- `mentionText.ts` module doc comment ("span including the leading `@`" → no longer true).
- `NewsContentRenderer` / reader rendering: it currently renders the stored span text as-is; verify it no longer assumes/strips a leading `@`.
- Unit tests in `apps/mobile/lib/__tests__/mentionText.test.ts`.
- `flattenBody` in [apps/mobile/app/news/new.tsx](../../../apps/mobile/app/news/new.tsx) — plain-text mirror follows automatically since it reads `text`, but confirm.

### 2. Same-weight accent highlight via a text overlay

Render an absolutely-positioned `<Text>` mirroring the field content, layered with the `TextInput`. The `TextInput` text is `color: 'transparent'` (caret colour kept via `cursorColor`/`selectionColor`); the overlay shows the same characters with mention spans styled in `fg.accent`.

**Why colour, not bold:** the overlay and the underlying textarea must align glyph-for-glyph or the caret drifts on web. Bold changes glyph widths → misalignment. Colour at the same font weight has identical metrics → exact alignment. (Decision confirmed with the user; "bold" intent delivered via accent colour.)

Overlay must mirror the `TextInput`'s font family/size/line-height/padding exactly and scroll-sync (the field is `multiline`; content can exceed the min height). Build the styled runs from `value` + `mentions` (a small pure helper `mentionRuns(text, mentions)` in `mentionText.ts`, unit-tested).

### 3. Atomic delete

Add `onKeyPress` handling in `MentionTextInput`. On `Backspace` when the caret is collapsed at the *end* of a mention span (or `Delete` at its *start*), remove the entire span's characters and drop the `NewsMention` in one edit, then set the predicted caret. All other edits keep flowing through the existing diff-based `adjustMentions`.

New pure helper `deleteMentionAt(text, mentions, caret, direction)` in `mentionText.ts` → `{ text, mentions, cursor } | null` (null = not at a mention edge, let the keystroke fall through). Unit-tested.

### 4. Dev backfill

Existing dev news blocks store `@Label` in `text` with spans that include the `@`. Write an idempotent `scripts/backfill-news-mention-at.mjs` (mirror `scripts/backfill-municipality-namelower.mjs`): project-id guard, only patch `news` docs whose text blocks contain a mention span starting with `@`, strip the `@`, and decrement each affected span's `offset`+`length` and shift later spans. Verify with `pnpm check:dev-conformance` before/after. No retrocompat dual-read in the reader.

## Rejected alternatives

- **Chip/token composer** — real non-text chips in a flowing layout. Truest to "atomic + highlighted", but a large rewrite of `BlockEditor` that discards the single-`TextInput` model and the offset/length data model. Too much surface area for a lightweight mention feature.
- **Cross-platform rich-text library** (10tap, contentEditable) — native rich mentions out of the box, but a heavy dependency, new data model, and web/native divergence risk.
- **Literal bold** — matches the user's wording but breaks caret alignment on the web textarea (glyph-width mismatch). Rejected in favour of same-weight accent colour.

## Out of scope / accepted risks

- **Overlay scroll-sync on the web `<textarea>`** — Task 4 syncs the overlay's `translateY` to the field's scroll offset. Verified manually on the web build (Task 4 step); if wrapped-line/scrolled alignment proves unfixable there, fall back to same-weight accent colour without the transparent-text overlay. Decided at implementation time, not now.
- **Native atomic-delete uses `preventDefault`, which only fires on RN-Web.** We are web-first (native unreleased), so the web path is authoritative. On native the mention annotation still drops correctly (via `adjustMentions`); only the "whole span in one keystroke" nicety may degrade to per-character. Verify on the AVD; acceptable if degraded.
- **Android keyboard-suggestion strip** — the atomic-delete path sets a predicted caret only on the delete keystroke, never controlling the `selection` prop continuously, so the existing NO_SUGGESTIONS bug is not reintroduced.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the news composer, show a picked `@`-reference as the bare name in accent colour (no `@`), and delete a whole reference in one Backspace/Delete keystroke.

**Architecture:** Keep the plain-`TextInput` + parallel `NewsMention[]` span model. Confine changes to the pure helpers in `apps/mobile/lib/mentionText.ts`, the `MentionTextInput` component (transparent-text input + scroll-synced styled `<Text>` overlay + `onKeyPress` atomic delete), and a one-off dev backfill. The reader (`RichText`) already slices its display label from `text[offset..]`, so dropping the `@` needs no reader logic change — only a shared run-splitter and a backfill.

**Tech Stack:** Expo SDK 54 / React Native / RN-Web, NativeWind v4, `@cultuvilla/shared` models, jest (mobile), firebase-admin (backfill).

## Global Constraints

- Strict TypeScript, no `any`, no `@ts-nocheck` (AGENTS.md §Strict TypeScript).
- Mobile screens/components never import `firebase/*` directly — backfill is a `scripts/*.mjs` admin script, not app code.
- New user-facing strings go through `useT()` / `packages/i18n/messages/es.json`. (This change adds no new copy — the mention list labels already exist.)
- Overlay mention runs use accent **colour only**, same font weight as the field, so glyph widths match and the web caret stays aligned. `underline` is allowed (does not change glyph advance); `font-medium`/bold is **not**.
- Backfill runs against dev (`villa-events`) only, idempotent, project-id guarded. Verify with `pnpm check:dev-conformance` before and after.
- Commit style: conventional commits, header ≤ 100 chars.

---

### Task 1: Shared `mentionRuns` run-splitter

Extract the run-splitting logic (currently inline in `RichText`) into a pure, tested helper so the reader and the editor overlay share one guard for out-of-range/overlapping spans.

**Files:**
- Modify: `apps/mobile/lib/mentionText.ts`
- Modify: `apps/mobile/components/feature/RichText.tsx:24-54`
- Test: `apps/mobile/lib/__tests__/mentionText.test.ts`

**Interfaces:**
- Produces: `interface MentionRun { text: string; mention?: NewsMention }` and `function mentionRuns(text: string, mentions: NewsMention[]): MentionRun[]`.

- [ ] **Step 1: Write the failing test** — append to `mentionText.test.ts`:

```ts
import { mentionRuns } from '../mentionText';

describe('mentionRuns', () => {
  it('splits text into plain and mention runs', () => {
    const m = [mention(5, 3, 'abc')]; // "abc" in "hola abc!"
    expect(mentionRuns('hola abc!', m)).toEqual([
      { text: 'hola ' },
      { text: 'abc', mention: m[0] },
      { text: '!' },
    ]);
  });

  it('skips an out-of-range span but keeps the prose', () => {
    const m = [mention(20, 3)];
    expect(mentionRuns('short', m)).toEqual([{ text: 'short' }]);
  });

  it('skips a span overlapping an earlier one', () => {
    const a = mention(0, 4, 'aaaa');
    const b = mention(2, 4, 'bbbb'); // overlaps a
    expect(mentionRuns('aaaabbbb', [a, b])).toEqual([
      { text: 'aaaa', mention: a },
      { text: 'bbbb' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test -- mentionText`
Expected: FAIL — `mentionRuns is not a function`.

- [ ] **Step 3: Implement `mentionRuns`** — add to `mentionText.ts`:

```ts
export interface MentionRun {
  /** The characters of this run, as they appear in the block text. */
  text: string;
  /** Present when this run is a committed mention span. */
  mention?: NewsMention;
}

/**
 * Split `text` into ordered runs of plain prose and mention spans. Spans that
 * are out of range, non-positive length, or overlap an earlier span are skipped
 * (their characters fall back to plain prose) so a malformed block still renders.
 */
export function mentionRuns(text: string, mentions: NewsMention[]): MentionRun[] {
  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  const runs: MentionRun[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.offset < cursor || m.offset + m.length > text.length || m.length <= 0) continue;
    if (m.offset > cursor) runs.push({ text: text.slice(cursor, m.offset) });
    runs.push({ text: text.slice(m.offset, m.offset + m.length), mention: m });
    cursor = m.offset + m.length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return runs;
}
```

- [ ] **Step 4: Refactor `RichText` to consume it** — replace the body of `RichText.tsx` (lines 24-54) with:

```tsx
export function RichText({ text, mentions, municipalityId, ...textProps }: RichTextProps) {
  if (!mentions.length) return <Text {...textProps}>{text}</Text>;

  const parts = mentionRuns(text, mentions).map((run, i) => {
    if (!run.mention) return <Fragment key={i}>{run.text}</Fragment>;
    const href = mentionHref(run.mention, municipalityId);
    return (
      <RNText
        key={i}
        className="text-accent font-medium underline"
        onPress={href ? () => router.push(href as never) : undefined}
      >
        {run.text}
      </RNText>
    );
  });

  return <Text {...textProps}>{parts}</Text>;
}
```

Add the import: `import { mentionRuns } from '../../lib/mentionText';`

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm app:test -- mentionText`
Expected: PASS (all `mentionRuns` cases + existing suites).

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm app:typecheck
git add apps/mobile/lib/mentionText.ts apps/mobile/lib/__tests__/mentionText.test.ts apps/mobile/components/feature/RichText.tsx
git commit -m "refactor(mobile): extract shared mentionRuns run-splitter"
```

---

### Task 2: `insertMention` drops the leading `@`

A picked reference commits as the bare label (no `@`); the span covers only the label.

**Files:**
- Modify: `apps/mobile/lib/mentionText.ts:130-166`
- Modify: `apps/mobile/lib/mentionText.ts:3-16` (module doc comment)
- Test: `apps/mobile/lib/__tests__/mentionText.test.ts:87-108`

**Interfaces:**
- Consumes: `mentionRuns` (Task 1) — no signature change to `insertMention`.

- [ ] **Step 1: Update the failing tests** — replace the `insertMention` describe block (lines 87-108) with:

```ts
describe('insertMention', () => {
  it('replaces the @query with the bare label and records the span', () => {
    const text = 'hola @Peñ';
    const active = activeMentionQuery(text, text.length, [])!;
    const res = insertMention(text, [], active, peña);
    expect(res.text).toBe('hola Peña El Barrio ');
    expect(res.mentions).toHaveLength(1);
    expect(res.mentions[0]).toMatchObject({ entityId: 'org1', offset: 5, length: 'Peña El Barrio'.length });
    // caret lands just after the inserted label + trailing space
    expect(res.cursor).toBe(5 + 'Peña El Barrio'.length + 1);
  });

  it('shifts a later mention when inserting before it', () => {
    const text = '@A end';
    const existing: NewsMention[] = [{ entityType: 'place', entityId: 'p', label: 'end', offset: 3, length: 3 }];
    const active = { query: 'A', startIndex: 0 };
    const res = insertMention(text, existing, active, peña);
    const shifted = res.mentions.find((m) => m.entityId === 'p')!;
    expect(shifted.offset).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test -- mentionText`
Expected: FAIL — `res.text` is `'hola @Peña El Barrio '`, offset/length off by one.

- [ ] **Step 3: Update `insertMention`** — change the three `@`-derived values in `mentionText.ts`:

```ts
export function insertMention(
  text: string,
  mentions: NewsMention[],
  active: ActiveMentionQuery,
  candidate: MentionCandidate,
): InsertMentionResult {
  const labelText = candidate.label; // no leading '@': the picked reference reads as its bare name
  const before = text.slice(0, active.startIndex);
  const after = text.slice(active.startIndex + 1 + active.query.length);
  const newText = `${before}${labelText} ${after}`;

  const consumedLen = 1 + active.query.length; // '@' + query, still consumed from the input
  const insertedLen = labelText.length + 1; // label + trailing space
  const shift = insertedLen - consumedLen;
  const afterPoint = active.startIndex + consumedLen;

  const shifted = mentions.map((m) =>
    m.offset >= afterPoint ? { ...m, offset: m.offset + shift } : m,
  );
  const newMention: NewsMention = {
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    label: candidate.label,
    offset: active.startIndex,
    length: labelText.length,
  };

  return {
    text: newText,
    mentions: [...shifted, newMention].sort((a, b) => a.offset - b.offset),
    cursor: active.startIndex + labelText.length + 1,
  };
}
```

- [ ] **Step 4: Fix the stale module doc** — in the header comment (lines ~7-8), change "the span including the leading `@`" to "the span covering the mention's display label (the `@` trigger is consumed on insert)".

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm app:test -- mentionText`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/mentionText.ts apps/mobile/lib/__tests__/mentionText.test.ts
git commit -m "feat(mobile): commit @-mentions as the bare label, no leading @"
```

---

### Task 3: `deleteMentionAt` atomic-delete helper

Pure helper deciding whether a collapsed caret sits at a mention edge and, if so, removing the whole span.

**Files:**
- Modify: `apps/mobile/lib/mentionText.ts`
- Test: `apps/mobile/lib/__tests__/mentionText.test.ts`

**Interfaces:**
- Produces: `type MentionDeleteDirection = 'backward' | 'forward'` and
  `function deleteMentionAt(text: string, mentions: NewsMention[], caret: number, direction: MentionDeleteDirection): { text: string; mentions: NewsMention[]; cursor: number } | null`.
- Consumed by: Task 4 (`MentionTextInput.handleKeyPress`).

- [ ] **Step 1: Write the failing test** — append to `mentionText.test.ts`:

```ts
import { deleteMentionAt } from '../mentionText';

describe('deleteMentionAt', () => {
  // "hola Peña mundo" with "Peña" (offset 5, length 4) a mention
  const text = 'hola Peña mundo';
  const m = [mention(5, 4, 'Peña')];

  it('Backspace at the end of a mention removes the whole span', () => {
    const res = deleteMentionAt(text, m, 9, 'backward');
    expect(res).toEqual({ text: 'hola  mundo', mentions: [], cursor: 5 });
  });

  it('Delete at the start of a mention removes the whole span', () => {
    const res = deleteMentionAt(text, m, 5, 'forward');
    expect(res).toEqual({ text: 'hola  mundo', mentions: [], cursor: 5 });
  });

  it('shifts a later mention left after the removed span', () => {
    const two = [mention(5, 4, 'Peña'), mention(10, 5, 'mundo')];
    const res = deleteMentionAt(text, two, 9, 'backward')!;
    expect(res.mentions).toEqual([{ ...two[1], offset: 6 }]); // 10 - 4
  });

  it('returns null when the caret is not at a mention edge', () => {
    expect(deleteMentionAt(text, m, 2, 'backward')).toBeNull();
    expect(deleteMentionAt(text, m, 7, 'backward')).toBeNull(); // inside the span
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test -- mentionText`
Expected: FAIL — `deleteMentionAt is not a function`.

- [ ] **Step 3: Implement `deleteMentionAt`** — add to `mentionText.ts`:

```ts
export type MentionDeleteDirection = 'backward' | 'forward';

export interface DeleteMentionResult {
  text: string;
  mentions: NewsMention[];
  /** Where the caret should land after the whole span is removed. */
  cursor: number;
}

/**
 * If a collapsed caret sits at the trailing edge of a mention (Backspace /
 * `backward`) or its leading edge (Delete / `forward`), remove the entire span's
 * characters and drop its annotation in one edit. Returns `null` when the caret
 * is not at a mention edge, so the caller lets the native keystroke fall through.
 */
export function deleteMentionAt(
  text: string,
  mentions: NewsMention[],
  caret: number,
  direction: MentionDeleteDirection,
): DeleteMentionResult | null {
  const target = mentions.find((m) =>
    direction === 'backward' ? caret === m.offset + m.length : caret === m.offset,
  );
  if (!target) return null;

  const start = target.offset;
  const end = target.offset + target.length;
  const newText = text.slice(0, start) + text.slice(end);
  const remaining = mentions
    .filter((m) => m !== target)
    .map((m) => (m.offset >= end ? { ...m, offset: m.offset - target.length } : m));

  return { text: newText, mentions: remaining, cursor: start };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm app:test -- mentionText`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/mentionText.ts apps/mobile/lib/__tests__/mentionText.test.ts
git commit -m "feat(mobile): add deleteMentionAt for atomic mention removal"
```

---

### Task 4: `MentionTextInput` — styled overlay + atomic delete wiring

Wire the two pure helpers into the component: a transparent-text `TextInput` over a scroll-synced styled `<Text>` overlay, and `onKeyPress` atomic delete.

**Files:**
- Modify: `apps/mobile/components/feature/MentionTextInput.tsx`

**Interfaces:**
- Consumes: `mentionRuns` (Task 1), `deleteMentionAt` (Task 3), `colors.light.fg.accent` (already imported as `ACCENT`).

- [ ] **Step 1: Add imports and the overlay/delete state** — extend the imports and top of the component:

```tsx
import { useMemo, useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
// ...existing imports...
import {
  activeMentionQuery,
  adjustMentions,
  deleteMentionAt,
  insertMention,
  mentionRuns,
  type MentionCandidate,
} from '../../lib/mentionText';
```

Inside the component, after the `selection` state:

```tsx
  const [scrollY, setScrollY] = useState(0);
  const runs = useMemo(() => mentionRuns(value, mentions), [value, mentions]);
```

- [ ] **Step 2: Add the key-press handler** — add alongside `handleChangeText`:

```tsx
  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    const key = e.nativeEvent.key;
    if (key !== 'Backspace' && key !== 'Delete') return;
    if (selection.start !== selection.end) return; // a range delete flows through adjustMentions
    const res = deleteMentionAt(value, mentions, selection.start, key === 'Backspace' ? 'backward' : 'forward');
    if (!res) return;
    // preventDefault fires on RN-Web (our primary target); it stops the textarea
    // from also eating one character. Native has no equivalent — see the plan's
    // accepted-risks note.
    (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    onChange(res.text, res.mentions);
    setSelection({ start: res.cursor, end: res.cursor });
  }
```

- [ ] **Step 3: Replace the field markup with the overlay + transparent input** — replace the `<View className="border …">…</View>` block (lines ~91-108) with:

```tsx
      <View className="border rounded-md px-3 py-2 bg-surface border-subtle" style={{ minHeight: 96 }}>
        <View style={{ position: 'relative', flex: 1 }}>
          <Text
            pointerEvents="none"
            className="text-body"
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: -scrollY }] }]}
          >
            {runs.map((run, i) =>
              run.mention ? (
                <Text key={i} className="text-accent underline">
                  {run.text}
                </Text>
              ) : (
                <Text key={i} className="text-primary">
                  {run.text}
                </Text>
              ),
            )}
          </Text>
          <TextInput
            value={value}
            onChangeText={handleChangeText}
            onKeyPress={handleKeyPress}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            multiline
            placeholder={placeholder}
            placeholderTextColor={colors.light.fg.muted}
            accessibilityLabel={placeholder}
            className="text-body"
            textAlignVertical="top"
            style={{ minHeight: 96, color: 'transparent' }}
            cursorColor={ACCENT}
            selectionColor={ACCENT}
            onFocus={onFocus}
            onSelectionChange={(e) => {
              const sel = e.nativeEvent.selection;
              setSelection(sel);
              onSelectionChange?.(sel.start);
            }}
          />
        </View>
      </View>
```

(Import `colors` is already at the top of the file; keep the existing `ACCENT` const.)

- [ ] **Step 4: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS — no type errors.

- [ ] **Step 5: Run the jest suite** (no new unit test for the component; logic is covered by the helper tests)

Run: `pnpm app:test`
Expected: PASS — existing suites unaffected.

- [ ] **Step 6: Manual verification on the web build** — ask the user to run `pnpm app:start` (web) and, in the news composer content step:
  - Type `@`, pick a reference → it appears as the bare name in accent colour, `@` gone.
  - Type prose before/after → the accent overlay text stays aligned with the caret through wrapped lines and after the field scrolls.
  - Put the caret just after a reference and press Backspace → the whole reference disappears in one keystroke; prose around it is intact.
  - Put the caret just before a reference and press Delete → same.

  If the overlay misaligns on wrapped/scrolled lines and can't be corrected, fall back to same-weight accent colour without the transparent overlay (see accepted-risks note) and record the decision in the PR.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/feature/MentionTextInput.tsx
git commit -m "feat(mobile): highlight picked mentions + atomic delete in composer"
```

---

### Task 5: Dev backfill — strip the stored `@` from existing news mentions

Existing dev `news` docs store `@Label` in their text blocks with spans that include the `@`. Strip it and fix offsets/lengths + the flattened `body`.

**Files:**
- Create: `scripts/backfill-news-mention-at.mjs`

- [ ] **Step 1: Write the script** (mirrors `scripts/backfill-municipality-namelower.mjs` boilerplate):

```js
#!/usr/bin/env node
/**
 * backfill-news-mention-at.mjs
 *
 * One-off: for every `news` doc in dev Firestore, drop the leading '@' that the
 * old composer stored in each mention span's text, and rebase the affected
 * mention offsets/lengths (and the flattened `body`) to match the new
 * bare-label format. See docs/plans/*/news-mention-editor-highlight.md.
 *
 * USAGE
 *   node scripts/backfill-news-mention-at.mjs
 *
 * Idempotent: a doc whose spans no longer start with '@' is left untouched.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

/** Strip a leading '@' from each mention span in one text block. Returns null if nothing to do. */
function stripBlock(block) {
  if (block.type !== 'text' || !Array.isArray(block.mentions) || block.mentions.length === 0) return null;
  const sorted = [...block.mentions].sort((a, b) => a.offset - b.offset);
  let removed = 0;
  let prev = 0;
  let newText = '';
  const newMentions = [];
  let changed = false;
  for (const m of sorted) {
    const at = m.offset;
    if (block.text[at] === '@' && m.length > 1) {
      newText += block.text.slice(prev, at); // text before the '@', minus it
      newMentions.push({ ...m, offset: at - removed, length: m.length - 1 });
      removed += 1;
      prev = at + 1;
      changed = true;
    } else {
      newMentions.push({ ...m, offset: at - removed });
    }
  }
  if (!changed) return null;
  newText += block.text.slice(prev);
  return { ...block, text: newText, mentions: newMentions };
}

/** Mirror apps/mobile/app/news/new.tsx flattenBody. */
function flattenBody(content) {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

async function main() {
  const snap = await db.collection('news').get();
  console.log(`Loaded ${snap.size} news docs.`);

  let patched = 0;
  let untouched = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!Array.isArray(data.content)) {
      untouched++;
      continue;
    }
    let anyChange = false;
    const newContent = data.content.map((block) => {
      const stripped = stripBlock(block);
      if (stripped) anyChange = true;
      return stripped ?? block;
    });
    if (!anyChange) {
      untouched++;
      continue;
    }
    batch.update(docSnap.ref, { content: newContent, body: flattenBody(newContent) });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\nDone.`);
  console.log(`  Untouched: ${untouched}`);
  console.log(`  Patched:   ${patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Baseline conformance** (see the `firebase-admin-dev` skill for `GOOGLE_APPLICATION_CREDENTIALS`)

Run: `pnpm check:dev-conformance`
Expected: news docs conform under the current (pre-run) converter.

- [ ] **Step 3: Run the backfill**

Run: `node scripts/backfill-news-mention-at.mjs`
Expected: prints `Patched: <n>` for docs that had `@`-led spans; a second run prints `Patched: 0` (idempotent).

- [ ] **Step 4: Verify conformance after**

Run: `pnpm check:dev-conformance`
Expected: still conforms; no nonconforming `news` docs.

- [ ] **Step 5: Manual spot-check** — ask the user (or via the AVD/web run) to open a seeded news post that had a mention and confirm the reader shows the bare styled name (no `@`).

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-news-mention-at.mjs
git commit -m "chore(scripts): backfill dev news to strip @ from mention spans"
```

---

### Task 6: Docs & CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (`## [Unreleased]`)
- Move: this plan `docs/plans/ongoing/` → retire per `managing-plans-lifecycle` once merged (not part of the code change).

- [ ] **Step 1: Add a CHANGELOG entry** under `## [Unreleased]`:

```markdown
- News composer: a picked `@`-reference now shows as its bare name in the accent colour (the `@` is dropped once selected), and Backspace/Delete removes a whole reference in one keystroke.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note news mention highlight + atomic delete"
```

## Self-Review

- **Spec coverage:** drop-`@` (Task 2 + Task 5 backfill), accent highlight overlay (Task 4 via Task 1 runs), atomic delete (Task 3 + Task 4), reader unaffected (Task 1 refactor keeps `RichText` output), migration (Task 5), no retrocompat shim (backfill, not dual-read). ✓
- **Placeholder scan:** none — every code step carries full code. ✓
- **Type consistency:** `mentionRuns` / `MentionRun`, `deleteMentionAt` / `MentionDeleteDirection` / `DeleteMentionResult` names match across Tasks 1/3/4. `insertMention` signature unchanged. ✓
