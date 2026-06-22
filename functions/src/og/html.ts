import type { OgMeta } from './fetchers';

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
 */
export function injectMeta(shell: string, og: OgMeta | null, url: string): string {
  const meta = og ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    imageUrl: null,
  };

  const tags = buildMetaTags(meta, url);

  const headCloseIdx = shell.toLowerCase().indexOf('</head>');
  if (headCloseIdx === -1) return fallbackSkeleton(tags);

  const head = shell.slice(0, headCloseIdx);
  const tail = shell.slice(headCloseIdx);

  const cleanedHead = stripExistingMeta(head);
  return cleanedHead + tags + tail;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMetaTags(meta: OgMeta, url: string): string {
  const title = escapeAttr(meta.title || DEFAULT_TITLE);
  const desc = escapeAttr(meta.description || DEFAULT_DESCRIPTION);
  const lines: string[] = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}"/>`,
    `<meta property="og:url" content="${escapeAttr(url)}"/>`,
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:description" content="${desc}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${title}"/>`,
    `<meta name="twitter:description" content="${desc}"/>`,
  ];
  if (meta.imageUrl) {
    const img = escapeAttr(meta.imageUrl);
    lines.push(
      `<meta property="og:image" content="${img}"/>`,
      `<meta property="og:image:width" content="1200"/>`,
      `<meta property="og:image:height" content="630"/>`,
      `<meta name="twitter:image" content="${img}"/>`,
    );
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
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, '');
}

function fallbackSkeleton(tags: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>${tags}</head><body></body></html>`;
}
