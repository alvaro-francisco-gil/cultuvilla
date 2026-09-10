import type { OgMeta } from './fetchers';

/**
 * schema.org structured data for a share-link page.
 *
 * Why it exists: the web build is a client-rendered SPA, so a crawler's first
 * look at `/event/{id}` is an empty `#root`. The meta tags tell it what the
 * page is *about*; JSON-LD tells it what the page *is* — which is what earns an
 * event its date/venue rich result rather than a plain blue link.
 *
 * Everything is best-effort, matching the rest of the OG pipeline: a missing
 * field is omitted rather than emitted empty, because an invalid `startDate` is
 * worse in Search Console than no `startDate` at all. Returns null when there is
 * nothing worth stating.
 */
export function buildJsonLd(og: OgMeta, url: string): string | null {
  const node = buildNode(og, url);
  if (!node) return null;
  // JSON inside <script> must not be able to close the tag early.
  const json = JSON.stringify(node).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

type JsonObject = Record<string, unknown>;

function buildNode(og: OgMeta, url: string): JsonObject | null {
  const detail = og.detail;
  if (!detail || !og.title) return null;

  const base: JsonObject = { '@context': 'https://schema.org', url, name: og.title };
  if (og.description) base['description'] = og.description;
  if (og.imageUrl) base['image'] = og.imageUrl;

  switch (detail.kind) {
    case 'event': {
      // startDate is required for an Event rich result; without it the node is
      // noise, so fall back to no structured data at all.
      if (!detail.startDate) return null;
      const node: JsonObject = {
        ...base,
        '@type': 'Event',
        startDate: detail.startDate,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: detail.cancelled
          ? 'https://schema.org/EventCancelled'
          : 'https://schema.org/EventScheduled',
      };
      if (detail.endDate) node['endDate'] = detail.endDate;
      const placeName = detail.locationName ?? detail.villageName;
      if (placeName) {
        const place: JsonObject = { '@type': 'Place', name: placeName };
        if (detail.villageName) {
          place['address'] = {
            '@type': 'PostalAddress',
            addressLocality: detail.villageName,
            addressCountry: 'ES',
          };
        }
        node['location'] = place;
      }
      return node;
    }
    case 'village': {
      const node: JsonObject = { ...base, '@type': 'City' };
      const address: JsonObject = { '@type': 'PostalAddress', addressCountry: 'ES' };
      if (detail.province) address['addressRegion'] = detail.province;
      node['address'] = address;
      if (detail.lat !== null && detail.lng !== null) {
        node['geo'] = { '@type': 'GeoCoordinates', latitude: detail.lat, longitude: detail.lng };
      }
      return node;
    }
    case 'org':
      return { ...base, '@type': 'Organization' };
    case 'news': {
      const node: JsonObject = { ...base, '@type': 'NewsArticle', headline: og.title };
      if (detail.publishedAt) node['datePublished'] = detail.publishedAt;
      return node;
    }
  }
}
