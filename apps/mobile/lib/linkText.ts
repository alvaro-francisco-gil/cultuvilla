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
  return runs;
}
