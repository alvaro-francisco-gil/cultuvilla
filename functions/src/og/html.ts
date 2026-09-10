import type { OgMeta } from './fetchers';
import { escapeHtml } from './escape';
import { buildJsonLd } from './jsonLd';
import { buildSeoBody } from './seoBody';

const SITE_NAME = 'Cultuvilla';
const DEFAULT_TITLE = 'Cultuvilla';
const DEFAULT_DESCRIPTION = 'Eventos y comunidad de tu pueblo.';

/**
 * Inject Open Graph + Twitter Card tags into an existing HTML shell.
 *
 * The shell comes from the SPA's `index.html`. We strip any existing
 * `<title>` / `og:*` / `twitter:*` / `description` tags first so the
 * crawler sees exactly one of each, then insert ours right before
 * `</head>`. The body is left untouched — the SPA still hydrates
 * normally for real users.
 *
 * If the shell has no `</head>` (defensive), we wrap the meta in a
 * minimal HTML skeleton instead so crawlers still get a valid response.
 *
 * JSON-LD rides along in the same insert: it is head-legal, it is stripped and
 * re-added atomically with the meta tags, and keeping the two together means a
 * page can never end up with a title describing one doc and structured data
 * describing another.
 */
export function injectMeta(shell: string, og: OgMeta | null, url: string): string {
  const meta = og ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    imageUrl: null,
  };

  const tags = buildMetaTags(meta, url) + (buildJsonLd(meta, url) ?? '');

  const headCloseIdx = shell.toLowerCase().indexOf('</head>');
  if (headCloseIdx === -1) return fallbackSkeleton(tags);

  const head = shell.slice(0, headCloseIdx);
  const tail = shell.slice(headCloseIdx);

  const cleanedHead = stripExistingMeta(head);
  return cleanedHead + tags + tail;
}

function buildMetaTags(meta: OgMeta, url: string): string {
  const title = escapeHtml(meta.title || DEFAULT_TITLE);
  const desc = escapeHtml(meta.description || DEFAULT_DESCRIPTION);
  const lines: string[] = [
    `<title>${title}</title>`,
    // Canonical is unconditional: every share URL can also arrive with tracking
    // query strings from WhatsApp/Instagram, and without this each variant is a
    // separate, competing URL in the index.
    `<link rel="canonical" href="${escapeHtml(url)}"/>`,
    `<meta name="description" content="${desc}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}"/>`,
    `<meta property="og:url" content="${escapeHtml(url)}"/>`,
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:description" content="${desc}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${title}"/>`,
    `<meta name="twitter:description" content="${desc}"/>`,
  ];
  if (meta.imageUrl) {
    const img = escapeHtml(meta.imageUrl);
    lines.push(
      `<meta property="og:image" content="${img}"/>`,
      `<meta property="og:image:width" content="1200"/>`,
      `<meta property="og:image:height" content="630"/>`,
      `<meta name="twitter:image" content="${img}"/>`,
    );
  }
  if (meta.noindex) {
    lines.push(`<meta name="robots" content="noindex,follow"/>`);
  }
  return lines.join('') + '\n';
}

/**
 * Remove any existing `<title>`, `<meta name="description">`,
 * `<meta property="og:*">`, `<meta name="twitter:*">` from the head so
 * crawlers don't see duplicates. Conservative — only matches the
 * specific tags we replace.
 */
function stripExistingMeta(head: string): string {
  return head
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

/**
 * Insert the server-rendered content block as a sibling immediately *before*
 * `<div id="root">`.
 *
 * Before, not inside: React clears its container on first commit, so content
 * placed inside `#root` would be destroyed the moment the app mounts — before
 * the app has data to replace it with. As a sibling it survives until the app
 * explicitly removes it (`dismissSeoShell`), which happens once the real screen
 * has loaded. The visitor therefore sees content, then content — never content,
 * then a spinner.
 *
 * A shell with no `#root` (only the defensive fallback) is returned untouched:
 * there is no app to hand over to, and `injectMeta` has already given the
 * crawler a valid document.
 */
export function injectSeoBody(shell: string, og: OgMeta | null): string {
  if (!og) return shell;
  const block = buildSeoBody(og);
  if (!block) return shell;

  const match = /<div\s+id=["']root["'][^>]*>/i.exec(shell);
  if (!match) return shell;

  const at = match.index;
  return shell.slice(0, at) + block + shell.slice(at);
}

function fallbackSkeleton(tags: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>${tags}</head><body></body></html>`;
}
