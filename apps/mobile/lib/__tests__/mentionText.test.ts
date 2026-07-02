import { describe, expect, it } from '@jest/globals';
import {
  activeMentionQuery,
  adjustMentions,
  insertMention,
  type MentionCandidate,
} from '../mentionText';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

const peña: MentionCandidate = { entityType: 'organization', entityId: 'org1', label: 'Peña El Barrio' };

function mention(offset: number, length: number, label = 'x'): NewsMention {
  return { entityType: 'place', entityId: 'p', label, offset, length };
}

describe('adjustMentions', () => {
  it('keeps spans entirely before the edit', () => {
    const m = [mention(0, 5)];
    // "hello world" -> "hello WORLD" edits after the span
    expect(adjustMentions('hello world', 'hello WORLD!', m)).toEqual(m);
  });

  it('shifts spans after an insertion', () => {
    const m = [mention(6, 5)]; // "world" in "hello world"
    const out = adjustMentions('hello world', 'oh hello world', m);
    expect(out[0]!.offset).toBe(9); // shifted by +3 ("oh ")
  });

  it('shifts spans left after a deletion before them', () => {
    const m = [mention(6, 5)];
    const out = adjustMentions('hello world', 'hi world', m);
    // "hello " (6) -> "hi " (3): delta -3
    expect(out[0]!.offset).toBe(3);
  });

  it('drops a span whose text was edited', () => {
    const m = [mention(6, 5)]; // "world"
    const out = adjustMentions('hello world', 'hello w0rld', m);
    expect(out).toEqual([]);
  });
});

describe('activeMentionQuery', () => {
  it('detects an @query at the cursor', () => {
    const text = 'hola @Peñ';
    expect(activeMentionQuery(text, text.length, [])).toEqual({ query: 'Peñ', startIndex: 5 });
  });

  it('returns null for a mid-word @ (email)', () => {
    const text = 'mail me a@b';
    expect(activeMentionQuery(text, text.length, [])).toBeNull();
  });

  it('does not span a newline', () => {
    const text = '@foo\nbar';
    expect(activeMentionQuery(text, text.length, [])).toBeNull();
  });

  it('ignores an @ inside an already-committed mention', () => {
    const text = '@Peña El Barrio ';
    const committed: NewsMention[] = [
      { entityType: 'organization', entityId: 'o', label: 'Peña El Barrio', offset: 0, length: 15 },
    ];
    // cursor right after the committed span + trailing space
    expect(activeMentionQuery(text, 10, committed)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the @query with @label and records the span', () => {
    const text = 'hola @Peñ';
    const active = activeMentionQuery(text, text.length, [])!;
    const res = insertMention(text, [], active, peña);
    expect(res.text).toBe('hola @Peña El Barrio ');
    expect(res.mentions).toHaveLength(1);
    expect(res.mentions[0]).toMatchObject({ entityId: 'org1', offset: 5, length: '@Peña El Barrio'.length });
    // caret lands just after the inserted label + trailing space
    expect(res.cursor).toBe(5 + '@Peña El Barrio'.length + 1);
  });

  it('shifts a later mention when inserting before it', () => {
    const text = '@A end';
    const existing: NewsMention[] = [{ entityType: 'place', entityId: 'p', label: 'end', offset: 3, length: 3 }];
    // type a new query at the start is awkward; instead insert where query is at 0
    const active = { query: 'A', startIndex: 0 };
    const res = insertMention(text, existing, active, peña);
    // '@A' (2 chars) -> '@Peña El Barrio ' grows the text; the 'end' span shifts right
    const shifted = res.mentions.find((m) => m.entityId === 'p')!;
    expect(shifted.offset).toBeGreaterThan(3);
  });
});
