import type { OgMeta } from './fetchers';
import { escapeHtml } from './escape';

/**
 * The visible, server-rendered content block for a share-link page.
 *
 * Why a real block and not crawler-only markup: the web build is an SPA, so
 * today the first paint on `/event/{id}` is blank until React mounts *and*
 * Firestore answers — on rural 4G that is a long stare at nothing, for the
 * exact visitor we care most about (someone who tapped a link in a WhatsApp
 * group). Serving the same HTML to crawlers and to people is both faster for
 * them and free of the cloaking risk that user-agent sniffing carries.
 *
 * It renders as a sibling *before* `#root`, and the app tears it down once the
 * real screen has its data (`dismissSeoShell`).
 *
 * It is a fixed, full-viewport overlay rather than a block in the flow, because
 * of the page it lands in: Expo's shell sets `body { overflow: hidden }` and
 * `#root { height: 100% }`. In the flow, this block pushed the whole app down
 * and the overflow clipped its bottom — tab bar included — for as long as the
 * block was up. As an overlay the app mounts and loads *underneath* it, and
 * removal reveals a finished screen: content, then content.
 *
 * Styling is inline and deliberately plain: it is on screen only until the app
 * has data, so it must be legible, not beautiful, and must not ship a
 * stylesheet.
 */
export function buildSeoBody(og: OgMeta): string {
  if (!og.title) return '';

  const parts: string[] = [];
  if (og.imageUrl) {
    parts.push(
      `<img src="${escapeHtml(og.imageUrl)}" alt="${escapeHtml(og.title)}" ` +
        `style="width:100%;max-height:340px;object-fit:cover;border-radius:12px"/>`,
    );
  }
  parts.push(
    `<h1 style="font-size:1.6rem;line-height:1.25;margin:16px 0 4px">${escapeHtml(og.title)}</h1>`,
  );

  const facts = buildFacts(og);
  if (facts) {
    parts.push(`<p style="margin:0 0 12px;color:#666;font-size:.95rem">${escapeHtml(facts)}</p>`);
  }
  if (og.description) {
    parts.push(
      `<p style="margin:0;line-height:1.5;white-space:pre-wrap">${escapeHtml(og.description)}</p>`,
    );
  }

  return (
    `<div id="seo-content" data-seo-shell="1" ` +
    `style="position:fixed;inset:0;z-index:2147483647;overflow-y:auto;` +
    `background:#fff;color:#1b1f23;` +
    `font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">` +
    `<article style="max-width:680px;margin:0 auto;padding:16px">${parts.join('')}</article>` +
    `</div>`
  );
}

/** The one-line subtitle: what a reader needs to decide whether to keep reading. */
function buildFacts(og: OgMeta): string {
  const detail = og.detail;
  if (!detail) return '';
  const bits: string[] = [];
  switch (detail.kind) {
    case 'event': {
      const when = formatSpanishDate(detail.startDate);
      if (when) bits.push(when);
      if (detail.locationName) bits.push(detail.locationName);
      if (detail.villageName && detail.villageName !== detail.locationName) {
        bits.push(detail.villageName);
      }
      if (detail.cancelled) bits.unshift('Cancelado');
      break;
    }
    case 'village': {
      if (detail.province) bits.push(detail.province);
      if (detail.comunidadAutonoma && detail.comunidadAutonoma !== detail.province) {
        bits.push(detail.comunidadAutonoma);
      }
      break;
    }
    case 'news': {
      const when = formatSpanishDate(detail.publishedAt);
      if (when) bits.push(when);
      break;
    }
    case 'org':
      break;
  }
  return bits.join(' · ');
}

/**
 * `es-ES` / Europe/Madrid, pinned explicitly. The shared `formatDate` helper
 * lives in the client bundle and is not reachable from functions; pinning both
 * here keeps a Cloud Run container's locale and TZ from leaking into what a
 * Spanish reader sees.
 */
function formatSpanishDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Madrid',
    }).format(date);
  } catch {
    return '';
  }
}
