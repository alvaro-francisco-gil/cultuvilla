import type { BusinessCard } from '@cultuvilla/shared/models';
import { buildMonths, datedItems, itemsAfterWindow, WEEKDAYS, type CalendarItem } from './calendar';
import { urgencyChip } from './labels';
import { chipStyles } from './theme';
import { sourceUrl } from './components';

function DayCell({ items, day, isToday, isPast }: { items: CalendarItem[]; day: number | null; isToday: boolean; isPast: boolean }) {
  if (day === null) return <span className="cell blank" />;
  const marked = items.length > 0;
  const classes = ['cell', isToday ? 'today' : '', isPast ? 'past' : '', marked ? 'marked' : ''].filter(Boolean);
  const title = marked ? items.map((i) => i.card.titulo).join(' · ') : undefined;
  return (
    <span className={classes.join(' ')} title={title}>
      {day}
      {marked ? <span className="dot" /> : null}
    </span>
  );
}

export function CalendarView({ cards, today }: { cards: BusinessCard[]; today: string }) {
  const items = datedItems(cards);
  const months = buildMonths(items, today, 3);
  const later = itemsAfterWindow(items, months);

  return (
    <div className="calendar">
      <div className="months">
        {months.map((month) => (
          <div className="month" key={month.key}>
            <h3>{month.label}</h3>
            <div className="grid">
              {WEEKDAYS.map((weekday, index) => (
                <span className="weekday" key={`${month.key}-wd-${String(index)}`}>
                  {weekday}
                </span>
              ))}
              {month.days.map((day, index) => (
                <DayCell key={`${month.key}-${String(index)}`} {...day} />
              ))}
            </div>
            {month.items.length === 0 ? (
              <p className="empty">Sin plazos</p>
            ) : (
              <ul className="agenda">
                {month.items.map(({ card, deadline }) => {
                  const dia = Number(deadline.slice(8, 10));
                  const { fg, bg } = chipStyles[urgencyChip(Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)).style];
                  return (
                    <li key={card.id}>
                      <a href={sourceUrl(card)} target="_blank" rel="noreferrer">
                        <span className="daybadge" style={{ color: fg, background: bg }}>{dia}</span>
                        <span>{card.titulo}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      {later.length > 0 ? (
        <p className="hint">
          Más adelante: {later.map((i) => `${i.card.titulo} (${i.deadline})`).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
