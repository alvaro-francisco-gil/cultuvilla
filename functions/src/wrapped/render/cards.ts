import type { WrappedStats } from '@cultuvilla/shared/models';
import { h, type SatoriNode } from './h';
import { CARD_HEIGHT, CARD_WIDTH, GUTTER, colors } from './theme';
import { copy } from './copy';
import { fitFontSize, fixedAspectGrid, hexLayout, mosaicLayout } from './layout';
import { colorFor, initials } from './images';

/**
 * Satori element trees for the five Wrapped cards. Satori renders a subset of
 * CSS: every element with more than one child must be `display: flex`, and all
 * text must sit directly inside an element. The trees are plain objects built
 * with `h()` rather than JSX.
 */

export interface CardContext {
  villageName: string;
  blockName: string;
  year: number;
  /** Pre-formatted, e.g. "14 – 28 de agosto". */
  dateRange: string;
}

const HEADER_HEIGHT = 380;
const FOOTER_HEIGHT = 130;
const BODY_TOP = HEADER_HEIGHT;
const BODY_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
const BODY_WIDTH = CARD_WIDTH - GUTTER * 2;

function text(value: string, style: Record<string, unknown>): SatoriNode {
  return h('div', { style: { display: 'flex', ...style } }, value);
}

/** Shared chrome: dark ground, kicker + title at the top, pueblo and year at the foot. */
function frame(ctx: CardContext, header: { kicker: string; title: string; subtitle?: string }, body: SatoriNode): SatoriNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: colors.ground,
        color: colors.ink,
        fontFamily: 'Archivo',
        position: 'relative',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          height: HEADER_HEIGHT,
          padding: `0 ${String(GUTTER)}px 44px`,
        },
      },
      text(header.kicker.toUpperCase(), { fontSize: 28, fontWeight: 600, letterSpacing: 5, color: colors.accentSoft }),
      text(header.title, {
        fontSize: fitFontSize(header.title, BODY_WIDTH, 104),
        fontWeight: 800,
        lineHeight: 1,
        marginTop: 14,
        letterSpacing: -2,
      }),
      header.subtitle ? text(header.subtitle, { fontSize: 38, color: colors.inkDim, marginTop: 16 }) : null,
    ),
    body,
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'absolute',
          left: GUTTER,
          right: GUTTER,
          bottom: 0,
          height: FOOTER_HEIGHT,
          borderTop: `2px solid ${colors.line}`,
        },
      },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        text(ctx.villageName, { fontSize: 32, fontWeight: 700 }),
        text(`${ctx.blockName} · ${String(ctx.year)}`, { fontSize: 26, color: colors.muted, marginTop: 4 }),
      ),
      text(copy.brand, { fontSize: 30, fontWeight: 800, color: colors.accent, letterSpacing: -0.5 }),
    ),
  );
}

// ── cover ────────────────────────────────────────────────────────────────

export function coverCard(ctx: CardContext, escudo: string | null): SatoriNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        padding: `${String(GUTTER * 1.6)}px ${String(GUTTER)}px ${String(GUTTER)}px`,
        backgroundColor: colors.ground,
        backgroundImage: `linear-gradient(170deg, #4a2418 0%, ${colors.ground} 58%)`,
        color: colors.ink,
        fontFamily: 'Archivo',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 28 } },
      escudo
        ? h('img', { src: escudo, width: 120, height: 120, style: { objectFit: 'cover', borderRadius: 28 } })
        : null,
      text(ctx.villageName.toUpperCase(), { fontSize: 34, fontWeight: 600, letterSpacing: 6, color: colors.accentSoft }),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      text(ctx.blockName, { fontSize: 148, fontWeight: 800, lineHeight: 0.95, letterSpacing: -4 }),
      text(String(ctx.year), { fontSize: 220, fontWeight: 800, lineHeight: 1, color: colors.accent, letterSpacing: -8, marginTop: 8 }),
      text(ctx.dateRange, { fontSize: 44, color: colors.inkDim, marginTop: 28 }),
    ),
    text(copy.brand, { fontSize: 36, fontWeight: 800, color: colors.accent }),
  );
}

// ── people ───────────────────────────────────────────────────────────────

export interface PersonBubble {
  name: string;
  photo: string | null;
  participant: boolean;
}

export function peopleCard(ctx: CardContext, people: PersonBubble[], censoParticipantCount: number): SatoriNode {
  const layout = hexLayout(people.length, BODY_WIDTH, BODY_HEIGHT - 90);
  const d = layout.diameter;

  const bubbles = people.map((p, i) => {
    const pos = layout.positions[i];
    const ring = p.participant ? colors.accent : 'transparent';
    const common = {
      position: 'absolute',
      left: pos.x,
      top: pos.y,
      width: d,
      height: d,
      borderRadius: d,
      border: `${String(Math.max(2, d * 0.06))}px solid ${ring}`,
      // Non-participants stay on the wall — this is everyone — just quieter.
      opacity: p.participant ? 1 : 0.42,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    };
    if (p.photo) {
      return h('div', { style: common }, h('img', { src: p.photo, width: d, height: d, style: { objectFit: 'cover' } }));
    }
    return h(
      'div',
      { style: { ...common, backgroundColor: colorFor(p.name) } },
      text(initials(p.name), { fontSize: d * 0.36, fontWeight: 700, color: colors.ink }),
    );
  });

  const legendDot = (color: string, opacity: number) =>
    h('div', { style: { display: 'flex', width: 26, height: 26, borderRadius: 26, backgroundColor: color, opacity } });

  const body = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: GUTTER, top: BODY_TOP, width: BODY_WIDTH, height: BODY_HEIGHT } },
    h('div', { style: { display: 'flex', position: 'relative', width: BODY_WIDTH, height: BODY_HEIGHT - 90 } }, ...bubbles),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 30 } },
      legendDot(colors.accent, 1),
      text(copy.peopleLegendIn, { fontSize: 26, color: colors.inkDim }),
      h('div', { style: { display: 'flex', width: 28 } }),
      legendDot(colors.sage, 0.42),
      text(copy.peopleLegendOut, { fontSize: 26, color: colors.inkDim }),
    ),
  );

  return frame(
    ctx,
    { kicker: copy.peopleKicker, title: copy.peopleTitle(people.length), subtitle: copy.peopleSubtitle(censoParticipantCount) },
    body,
  );
}

// ── events ───────────────────────────────────────────────────────────────

export interface EventTile {
  title: string;
  dateLabel: string;
  image: string | null;
}

/** Most tiles the mosaic draws before collapsing the rest into "y N más". */
export const MAX_EVENT_TILES = 24;

export function eventsCard(ctx: CardContext, events: EventTile[]): SatoriNode {
  const shown = events.slice(0, MAX_EVENT_TILES);
  const hidden = events.length - shown.length;
  const gap = 14;
  const g = mosaicLayout(shown.length, BODY_WIDTH, BODY_HEIGHT - (hidden > 0 ? 70 : 20), gap, 0.92);
  const titleSize = Math.max(20, Math.min(34, g.tileWidth / 11));

  // The flyers carry their own lettering, so a title laid over them collides
  // with it and neither reads. The caption sits in its own band underneath.
  const captionHeight = Math.round(Math.min(96, g.tileHeight * 0.34));
  const imageHeight = g.tileHeight - captionHeight;
  const tiles = shown.map((e) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: g.tileWidth,
          height: g.tileHeight,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.groundRaised,
        },
      },
      h(
        'div',
        { style: { display: 'flex', width: g.tileWidth, height: imageHeight, backgroundColor: colorFor(e.title) } },
        e.image ? h('img', { src: e.image, width: g.tileWidth, height: imageHeight, style: { objectFit: 'cover' } }) : null,
      ),
      h(
        'div',
        {
          style: {
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            height: captionHeight, padding: '0 14px',
          },
        },
        text(e.dateLabel.toUpperCase(), { fontSize: titleSize * 0.6, fontWeight: 600, letterSpacing: 2, color: colors.accentSoft }),
        text(e.title, { fontSize: titleSize * 0.82, fontWeight: 700, lineHeight: 1.1, marginTop: 3, overflow: 'hidden', maxHeight: titleSize * 0.82 * 2.2 }),
      ),
    ),
  );

  const body = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: GUTTER, top: BODY_TOP, width: BODY_WIDTH } },
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap, width: BODY_WIDTH } }, ...tiles),
    hidden > 0 ? text(copy.eventsMore(hidden), { fontSize: 32, color: colors.inkDim, marginTop: 26 }) : null,
  );

  return frame(ctx, { kicker: copy.eventsKicker, title: copy.eventsTitle(events.length) }, body);
}

// ── organizers ───────────────────────────────────────────────────────────

export interface CreditRow {
  name: string;
  count: number;
  image: string | null;
}

function creditRow(row: CreditRow, size: number, lead: boolean): SatoriNode {
  const avatar = row.image
    ? h('img', { src: row.image, width: size, height: size, style: { objectFit: 'cover', borderRadius: size } })
    : h(
        'div',
        {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: size, height: size, borderRadius: size, backgroundColor: colorFor(row.name),
          },
        },
        text(initials(row.name), { fontSize: size * 0.36, fontWeight: 700 }),
      );
  return h(
    'div',
    {
      style: {
        display: 'flex', alignItems: 'center', gap: 28,
        padding: lead ? '28px 30px' : '18px 0',
        backgroundColor: lead ? colors.groundRaised : 'transparent',
        borderRadius: lead ? 24 : 0,
      },
    },
    avatar,
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      text(row.name, { fontSize: lead ? 44 : 36, fontWeight: 700, lineHeight: 1.1 }),
      text(copy.eventCount(row.count), { fontSize: lead ? 32 : 28, color: colors.accentSoft, marginTop: 6 }),
    ),
  );
}

export function organizersCard(ctx: CardContext, orgs: CreditRow[], people: CreditRow[]): SatoriNode {
  const section = (label: string) =>
    text(label.toUpperCase(), { fontSize: 24, fontWeight: 600, letterSpacing: 4, color: colors.muted, marginBottom: 14 });

  const body = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: GUTTER, top: BODY_TOP, width: BODY_WIDTH, gap: 40 } },
    orgs.length > 0
      ? h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
          section(copy.organizersOrgs),
          ...orgs.map((o, i) => creditRow(o, i === 0 ? 130 : 96, i === 0)),
        )
      : null,
    people.length > 0
      ? h(
          'div',
          { style: { display: 'flex', flexDirection: 'column' } },
          section(copy.organizersPeople),
          ...people.map((p) => creditRow(p, 84, false)),
        )
      : null,
  );

  return frame(ctx, { kicker: copy.organizersKicker, title: copy.organizersTitle }, body);
}

// ── stats ────────────────────────────────────────────────────────────────

export interface StatsHighlight {
  title: string;
  count: number;
  capacity: number | null;
}

export function statsCard(ctx: CardContext, stats: WrappedStats, fullest: StatsHighlight | null): SatoriNode {
  const tile = (value: number, label: string, accent: boolean) =>
    h(
      'div',
      {
        style: {
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          width: (BODY_WIDTH - 24) / 2, height: 250, padding: 30,
          backgroundColor: colors.groundRaised, borderRadius: 26,
        },
      },
      text(String(value), { fontSize: 112, fontWeight: 800, lineHeight: 1, letterSpacing: -3, color: accent ? colors.accent : colors.ink }),
      text(label, { fontSize: 30, color: colors.inkDim, marginTop: 10, lineHeight: 1.2 }),
    );

  const body = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: GUTTER, top: BODY_TOP, width: BODY_WIDTH } },
    // Everyone who took part. Deliberately NOT read against the censo: this
    // figure includes personas with no village link and people from elsewhere,
    // so "N de censoCount" would be a false ratio. The censo ratio lives on the
    // people card, computed against the censo.
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', marginBottom: 34 } },
      text(String(stats.uniquePersonCount), { fontSize: 230, fontWeight: 800, lineHeight: 0.9, letterSpacing: -8, color: colors.accent }),
      text(copy.statsPeople, { fontSize: 44, fontWeight: 600, marginTop: 10 }),
    ),
    h(
      'div',
      { style: { display: 'flex', flexWrap: 'wrap', gap: 24 } },
      tile(stats.eventCount, copy.statsEvents, false),
      tile(stats.confirmedCount, copy.statsSignups, false),
      tile(stats.commentCount, copy.statsComments, false),
      tile(stats.waitlistedCount, copy.statsWaitlist, false),
    ),
    fullest
      ? h(
          'div',
          {
            style: {
              display: 'flex', flexDirection: 'column', marginTop: 24, padding: '30px 32px',
              borderRadius: 26, border: `2px solid ${colors.accent}`,
            },
          },
          text(copy.statsFullest.toUpperCase(), { fontSize: 24, fontWeight: 600, letterSpacing: 4, color: colors.accentSoft }),
          text(fullest.title, { fontSize: 44, fontWeight: 700, lineHeight: 1.12, marginTop: 10 }),
          text(copy.statsFullestCount(fullest.count, fullest.capacity), { fontSize: 32, color: colors.inkDim, marginTop: 8 }),
        )
      : null,
  );

  return frame(ctx, { kicker: copy.statsKicker, title: ctx.blockName }, body);
}

// ── carteles ─────────────────────────────────────────────────────────────

export interface CartelTile {
  year: number;
  image: string | null;
  isThisYear: boolean;
}

export const POSTER_ASPECT = 2 / 3;
const TIMELINE_HEIGHT = 120;

/**
 * The pueblo's poster archive, oldest first, so this year's carteles land at
 * the end of the wall — added to the history rather than shown on their own.
 *
 * The timeline underneath marks every year that HAS a cartel and leaves the
 * others blank. It shows the gaps without explaining them: the archive is
 * crowdsourced, so a gap means nobody uploaded that year, not that there were
 * no fiestas.
 */
export function postersCard(
  ctx: CardContext,
  tiles: CartelTile[],
  history: { firstYear: number | null; spanYears: number; yearsWithCartel: number[]; thisYearCount: number },
): SatoriNode {
  const gap = 8;
  const wallHeight = BODY_HEIGHT - TIMELINE_HEIGHT - 40;
  const g = fixedAspectGrid(tiles.length, BODY_WIDTH, wallHeight, gap, POSTER_ASPECT);
  const ring = Math.max(3, g.tileWidth * 0.045);

  const wall = tiles.map((t) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          position: 'relative',
          width: g.tileWidth,
          height: g.tileHeight,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: colors.groundRaised,
          border: t.isThisYear ? `${String(ring)}px solid ${colors.accent}` : `1px solid ${colors.line}`,
        },
      },
      t.image ? h('img', { src: t.image, width: g.tileWidth, height: g.tileHeight, style: { objectFit: 'cover' } }) : null,
      t.isThisYear
        ? h(
            'div',
            {
              style: {
                display: 'flex', position: 'absolute', left: 0, right: 0, bottom: 0,
                justifyContent: 'center', padding: '4px 0', backgroundColor: colors.accent,
              },
            },
            text(String(t.year), { fontSize: Math.max(14, g.tileWidth * 0.17), fontWeight: 800, color: colors.ink }),
          )
        : null,
    ),
  );

  const first = history.firstYear ?? ctx.year;
  const span = Math.max(1, ctx.year - first);
  const present = new Set(history.yearsWithCartel);
  const ticks: SatoriNode[] = [];
  for (let y = first; y <= ctx.year; y++) {
    if (!present.has(y)) continue;
    const isNow = y === ctx.year;
    ticks.push(
      h('div', {
        style: {
          display: 'flex', position: 'absolute',
          left: ((y - first) / span) * (BODY_WIDTH - 6),
          bottom: 0,
          width: isNow ? 8 : 5,
          height: isNow ? 56 : 30,
          borderRadius: 3,
          backgroundColor: isNow ? colors.accent : colors.inkDim,
        },
      }),
    );
  }

  const timeline = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', marginTop: 40, width: BODY_WIDTH } },
    h(
      'div',
      { style: { display: 'flex', position: 'relative', width: BODY_WIDTH, height: 58, borderBottom: `2px solid ${colors.line}` } },
      ...ticks,
    ),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', marginTop: 12 } },
      text(String(first), { fontSize: 28, fontWeight: 600, color: colors.inkDim }),
      text(String(ctx.year), { fontSize: 28, fontWeight: 800, color: colors.accent }),
    ),
  );

  const body = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: GUTTER, top: BODY_TOP, width: BODY_WIDTH } },
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap, width: BODY_WIDTH } }, ...wall),
    timeline,
  );

  return frame(
    ctx,
    { kicker: copy.postersKicker, title: copy.postersTitle(history.spanYears), subtitle: copy.postersAdded(history.thisYearCount) },
    body,
  );
}
