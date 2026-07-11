import { describe, it, expect } from 'vitest';
import {
  NewsPostDataSchema,
  NewsImageBlockSchema,
  MENTION_ENTITY_TYPES,
  buildNewsPostData,
  NEWS_POST_CATEGORIES,
  type NewsPostCategory,
} from '../../../src/models/news/NewsPostDataModel';
import { NewsTextBlockSchema, NewsLinkSchema } from '../../../src/models/news/NewsPostDataModel';

describe('MENTION_ENTITY_TYPES', () => {
  it('is the entity family plus village, and excludes persons', () => {
    expect([...MENTION_ENTITY_TYPES]).toEqual([
      'organization',
      'event',
      'place',
      'barrio',
      'village',
      'news',
      'festivalPoster',
    ]);
    expect(MENTION_ENTITY_TYPES as readonly string[]).not.toContain('user');
  });
});

describe('NewsImageBlockSchema captionMentions', () => {
  const base = { type: 'image' as const, storagePath: 'p/1', width: 100, height: 50, caption: 'Foto de Peña El Barrio' };

  it('defaults captionMentions to [] for a legacy image block without the field', () => {
    const parsed = NewsImageBlockSchema.parse(base);
    expect(parsed.captionMentions).toEqual([]);
  });

  it('keeps caption mention spans when present', () => {
    const mention = { entityType: 'organization' as const, entityId: 'org1', label: 'Peña El Barrio', offset: 9, length: 14 };
    const parsed = NewsImageBlockSchema.parse({ ...base, captionMentions: [mention] });
    expect(parsed.captionMentions).toEqual([mention]);
  });
});

describe('NewsLinkSchema', () => {
  it('accepts a well-formed http(s) link span', () => {
    const link = { url: 'https://entradas.example.com', offset: 4, length: 6 };
    expect(NewsLinkSchema.parse(link)).toEqual(link);
  });

  it('rejects a non-URL string', () => {
    expect(() => NewsLinkSchema.parse({ url: 'not a url', offset: 0, length: 1 })).toThrow();
  });

  it('rejects an unsafe scheme like javascript:', () => {
    expect(() =>
      NewsLinkSchema.parse({ url: 'javascript:alert(1)', offset: 0, length: 1 }),
    ).toThrow();
  });

  it('accepts a normal https URL', () => {
    const link = { url: 'https://x.com', offset: 0, length: 4 };
    expect(NewsLinkSchema.parse(link)).toEqual(link);
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

describe('NewsPostDataSchema', () => {
  it('accepts a post with organizerUserIds + organizerOrgIds', () => {
    const now = new Date();
    const parsed = NewsPostDataSchema.parse({
      municipalityId: 'm1',
      organizerUserIds: ['u'],
      organizerOrgIds: [],
      createdBy: 'u',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      images: [{ storagePath: 'p/1', width: 100, height: 50 }],
      status: 'active',
      hiddenBy: null,
      hiddenAt: null,
      hiddenReason: null,
      createdAt: now,
      publishedAt: now,
      updatedAt: now,
      readCount: 0,
      commentCount: 0,
    });
    expect(parsed.organizerUserIds).toEqual(['u']);
    expect(parsed.organizerOrgIds).toEqual([]);
    expect(parsed.createdBy).toBe('u');
    expect(parsed.title).toBe('Fiesta');
    expect(parsed.images).toHaveLength(1);
    // authorUserId and authorOrgId must not be in the parsed shape
    expect('authorUserId' in parsed).toBe(false);
    expect('authorOrgId' in parsed).toBe(false);
  });

  it('rejects when a required field is missing', () => {
    const now = new Date();
    expect(() =>
      NewsPostDataSchema.parse({
        // municipalityId missing
        organizerUserIds: ['u1'],
        organizerOrgIds: [],
        createdBy: 'u1',
        title: 'Fiesta',
        body: 'Detalles',
        category: 'fiesta',
        images: [],
        status: 'active',
        hiddenBy: null,
        hiddenAt: null,
        hiddenReason: null,
        createdAt: now,
        publishedAt: now,
        updatedAt: now,
        readCount: 0,
        commentCount: 0,
      }),
    ).toThrow();
  });

  it('rejects an out-of-enum category', () => {
    const now = new Date();
    expect(() =>
      NewsPostDataSchema.parse({
        municipalityId: 'm1',
        organizerUserIds: ['u1'],
        organizerOrgIds: [],
        createdBy: 'u1',
        title: 'Fiesta',
        body: 'Detalles',
        category: 'not-a-category',
        images: [],
        status: 'active',
        hiddenBy: null,
        hiddenAt: null,
        hiddenReason: null,
        createdAt: now,
        publishedAt: now,
        updatedAt: now,
        readCount: 0,
        commentCount: 0,
      }),
    ).toThrow();
  });
});

describe('buildNewsPostData', () => {
  it('produces an active post with zeroed counters by default', () => {
    const now = new Date();
    const p = buildNewsPostData({
      municipalityId: 'm1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      createdBy: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      createdAt: now,
      updatedAt: now,
    });
    expect(p.status).toBe('active');
    expect(p.hiddenBy).toBeNull();
    expect(p.hiddenAt).toBeNull();
    expect(p.hiddenReason).toBeNull();
    expect(p.createdAt).toEqual(now);
    expect(p.publishedAt).toEqual(now);
    expect(p.images).toEqual([]);
    expect(p.readCount).toBe(0);
    expect(p.commentCount).toBe(0);
    expect('reactionCounts' in p).toBe(false);
    expect(p.organizerUserIds).toEqual(['u1']);
    expect(p.organizerOrgIds).toEqual([]);
    // fields removed by the review -> visibility migration
    expect('submittedAt' in p).toBe(false);
    expect('rejectionReason' in p).toBe(false);
    expect('reviewedBy' in p).toBe(false);
  });

  it('defaults publishedAt to createdAt when not given, and honors an explicit publishedAt', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const published = new Date('2026-01-02T00:00:00Z');

    const withoutPublishedAt = buildNewsPostData({
      municipalityId: 'm1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      createdBy: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      createdAt: created,
      updatedAt: created,
    });
    expect(withoutPublishedAt.publishedAt).toEqual(created);

    const withPublishedAt = buildNewsPostData({
      municipalityId: 'm1',
      organizerUserIds: ['u1'],
      organizerOrgIds: [],
      createdBy: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      createdAt: created,
      publishedAt: published,
      updatedAt: created,
    });
    expect(withPublishedAt.publishedAt).toEqual(published);
  });

  it('exposes the canonical category list', () => {
    const expected: NewsPostCategory[] = ['fiesta', 'tradicion', 'gastronomia', 'historia', 'otro'];
    expect(NEWS_POST_CATEGORIES).toEqual(expected);
  });
});
