import type { NewsMention, NewsLink } from '@cultuvilla/shared/models/news/NewsPostDataModel';
import { adjustMentions, type Span } from './mentionText';
import { normalizeBolds } from './boldText';

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

function commonSuffixLength(a: string, b: string, cap: number): number {
  let i = 0;
  while (i < cap && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
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
  const cap = Math.min(oldText.length, newText.length) - prefix;
  const suffix = commonSuffixLength(oldText, newText, Math.max(0, cap));
  const inserted = newText.slice(prefix, newText.length - suffix);
  if (inserted.length <= 1) return null;
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

/**
 * Record a custom-text link over an existing selection `[start, end)` (the
 * display text is already in `text`, so `text` is unchanged — only a link span
 * is added). Callers must pass a safe http(s) `url` and a non-empty range.
 */
export function addLinkSpan(links: NewsLink[], start: number, end: number, url: string): NewsLink[] {
  if (end <= start) return links;
  const span: NewsLink = { url, offset: start, length: end - start };
  return [...links, span].sort((a, b) => a.offset - b.offset);
}

export interface LinkRun {
  text: string;
  mention?: NewsMention;
  link?: NewsLink;
  autoUrl?: string;
  bold?: boolean;
}

/**
 * Subdivide contiguous runs at bold-span boundaries, tagging each resulting run
 * with `bold`. Bold is orthogonal to mentions/links (the same characters can be
 * both), so it is applied as a second pass over the already-built runs rather
 * than competing for the same span slot. `runs` must cover `text` contiguously
 * and in order (as {@link buildLinkRuns} produces them) so offsets line up.
 */
function applyBold(runs: LinkRun[], bolds: Span[]): LinkRun[] {
  const norm = normalizeBolds(bolds);
  if (norm.length === 0) return runs;
  const out: LinkRun[] = [];
  let offset = 0;
  for (const run of runs) {
    const start = offset;
    const end = offset + run.text.length;
    offset = end;
    const cuts = new Set<number>([start, end]);
    for (const b of norm) {
      const bEnd = b.offset + b.length;
      if (b.offset > start && b.offset < end) cuts.add(b.offset);
      if (bEnd > start && bEnd < end) cuts.add(bEnd);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const bold = norm.some((b) => b.offset <= from && b.offset + b.length >= to);
      out.push({ ...run, text: run.text.slice(from - start, to - start), bold });
    }
  }
  return out;
}

/**
 * Split `text` into ordered runs: mention spans, stored link spans, bare-URL
 * autolinks, and plain prose, each optionally tagged `bold`. Mentions and stored
 * links are laid down first (mentions win on overlap); autolinks fill only the
 * still-plain gaps, so a URL inside a stored span is never double-linked; bold is
 * applied as an orthogonal overlay on top. Out-of-range / overlapping /
 * non-positive spans are skipped so a malformed block still renders.
 */
export function buildLinkRuns(
  text: string,
  mentions: NewsMention[],
  links: NewsLink[],
  bolds: Span[] = [],
): LinkRun[] {
  type Tagged = Span & { mention?: NewsMention; link?: NewsLink };
  const tagged: Tagged[] = [
    ...mentions.map((m): Tagged => ({ offset: m.offset, length: m.length, mention: m })),
    ...links.map((l): Tagged => ({ offset: l.offset, length: l.length, link: l })),
  ];
  tagged.sort((a, b) => a.offset - b.offset || (a.mention ? -1 : 1));

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
  return applyBold(runs, bolds);
}
