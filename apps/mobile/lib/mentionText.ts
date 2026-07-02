import type { NewsMention, MentionEntityType } from '@cultuvilla/shared/models/news/NewsPostDataModel';

/**
 * Pure helpers backing the `@`-mention behaviour of a plain-text `TextInput`.
 *
 * A text block stores its prose in `text` and annotates mention ranges in
 * `mentions` (offset/length into `text`, the span including the leading `@`).
 * RN gives us only a raw string + selection, so these functions keep the
 * `mentions` array consistent as the user edits:
 *
 * - {@link adjustMentions} shifts/drops spans after an arbitrary edit.
 * - {@link activeMentionQuery} detects an in-progress `@query` at the cursor.
 * - {@link insertMention} commits a picked candidate into the text + spans.
 *
 * All are pure and unit-tested (see `__tests__/mentionText.test.ts`).
 */

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLength(a: string, b: string, cap: number): number {
  let i = 0;
  while (i < cap && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * Recompute mention spans after `oldText` was edited into `newText`. Spans fully
 * before the edited region are kept; spans fully after are shifted by the length
 * delta; spans overlapping the edit are dropped (their text changed, so the
 * annotation is no longer trustworthy).
 */
export function adjustMentions(
  oldText: string,
  newText: string,
  mentions: NewsMention[],
): NewsMention[] {
  if (oldText === newText) return mentions;
  const prefix = commonPrefixLength(oldText, newText);
  const cap = Math.min(oldText.length, newText.length) - prefix;
  const suffix = commonSuffixLength(oldText, newText, Math.max(0, cap));
  const oldChangeEnd = oldText.length - suffix; // exclusive
  const delta = newText.length - oldText.length;

  const result: NewsMention[] = [];
  for (const m of mentions) {
    const end = m.offset + m.length;
    if (end <= prefix) {
      result.push(m);
    } else if (m.offset >= oldChangeEnd) {
      result.push({ ...m, offset: m.offset + delta });
    }
    // else: overlaps the edited region → drop
  }
  return result;
}

export interface ActiveMentionQuery {
  /** Text typed after the `@`, up to the cursor (may contain spaces). */
  query: string;
  /** Index of the triggering `@` in `text`. */
  startIndex: number;
}

/**
 * If the cursor sits inside an in-progress mention token — an `@` that begins a
 * word (preceded by start-of-text or whitespace) with no newline between it and
 * the cursor, and not inside an already-committed mention — return the query.
 * Otherwise `null`.
 */
export function activeMentionQuery(
  text: string,
  cursor: number,
  mentions: NewsMention[],
): ActiveMentionQuery | null {
  let i = cursor - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '\n') return null; // mentions don't span lines
    if (ch === '@') {
      const before = i === 0 ? '' : (text[i - 1] ?? '');
      if (before !== '' && !/\s/.test(before)) return null; // mid-word @, e.g. an email
      // Don't re-trigger on an already-committed mention span.
      if (mentions.some((m) => m.offset <= i && i < m.offset + m.length)) return null;
      return { query: text.slice(i + 1, cursor), startIndex: i };
    }
    i--;
  }
  return null;
}

/**
 * Split a text block's mention spans at `caret` (for inserting an image
 * mid-paragraph). Spans entirely before the caret stay in `before`; spans
 * entirely after move to `after` with offsets rebased to the split point; a span
 * straddling the caret is dropped.
 */
export function splitMentionsAtCaret(
  mentions: NewsMention[],
  caret: number,
): { before: NewsMention[]; after: NewsMention[] } {
  const before: NewsMention[] = [];
  const after: NewsMention[] = [];
  for (const m of mentions) {
    const end = m.offset + m.length;
    if (end <= caret) before.push(m);
    else if (m.offset >= caret) after.push({ ...m, offset: m.offset - caret });
    // straddles the caret → dropped
  }
  return { before, after };
}

export interface MentionCandidate {
  entityType: MentionEntityType;
  entityId: string;
  label: string;
}

export interface InsertMentionResult {
  text: string;
  mentions: NewsMention[];
  /** Where the caret should land after insertion. */
  cursor: number;
}

/**
 * Replace the active `@query` with `@{label} ` and record the mention span.
 * Existing spans after the insertion point are shifted by the length change.
 */
export function insertMention(
  text: string,
  mentions: NewsMention[],
  active: ActiveMentionQuery,
  candidate: MentionCandidate,
): InsertMentionResult {
  const labelText = `@${candidate.label}`;
  const before = text.slice(0, active.startIndex);
  const after = text.slice(active.startIndex + 1 + active.query.length);
  const newText = `${before}${labelText} ${after}`;

  const consumedLen = 1 + active.query.length; // '@' + query
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
