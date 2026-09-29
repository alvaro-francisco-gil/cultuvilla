import { useState } from 'react';
import type { BusinessCard } from '@cultuvilla/shared/models';
import { chipStyles, monogramColors, type ChipStyle } from './theme';
import { chipsFor, isClosed } from './labels';
import { faviconUrl, monogram, monogramColorIndex } from './logo';
import { destinationUrl, sourceUrl } from './links';

export function Chip({ label, style }: { label: string; style: ChipStyle }) {
  const { fg, bg } = chipStyles[style];
  return (
    <span className="chip" style={{ color: fg, background: bg }}>
      {label}
    </span>
  );
}

/**
 * The entity's favicon, falling back to a coloured monogram. Most registry
 * entities have no verified URL yet, so the monogram is the normal case rather
 * than the error case — and it still gives each entity a stable, recognisable
 * mark, which is most of what a logo is for in a list.
 */
export function EntityMark({ card }: { card: BusinessCard }) {
  const [broken, setBroken] = useState(false);
  const icon = faviconUrl(card.url);
  const { fg, bg } = monogramColors[monogramColorIndex(card.id, monogramColors.length)] ?? monogramColors[0];

  if (icon && !broken) {
    return (
      <img
        className="mark"
        src={icon}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="mark monogram" style={{ color: fg, background: bg }} aria-hidden="true">
      {monogram(card.titulo)}
    </span>
  );
}

export function CardRow({ card, dias }: { card: BusinessCard; dias: number | null }) {
  const chips = chipsFor(card, dias);
  const detail = [card.convocante, card.importe, card.lugar, card.plazas, card.tipo, card.cobertura]
    .filter((value) => value && !value.includes('[['))
    .join(' · ');

  const href = destinationUrl(card);
  const record = sourceUrl(card);

  return (
    <li className="cardrow">
      <a
        className={isClosed(card) ? 'card closed' : 'card'}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        <EntityMark card={card} />
        <span className="body">
          <span className="titulo">{card.titulo}</span>
          <span className="chips">
            {chips.map((chip) => (
              <Chip key={`${card.id}-${chip.label}`} label={chip.label} style={chip.style} />
            ))}
          </span>
          {detail ? <span className="detail">{detail}</span> : null}
          {card.sinHallazgos ? <span className="detail">Sin resultado: {card.sinHallazgos}</span> : null}
        </span>
      </a>
      {href === record ? null : (
        <a className="ficha" href={record} target="_blank" rel="noreferrer">
          ficha
        </a>
      )}
    </li>
  );
}
