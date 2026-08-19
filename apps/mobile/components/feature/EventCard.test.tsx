import { getMessages } from '@cultuvilla/i18n';
import { createI18n } from '../../lib/i18n';
import { registrationRibbonProps } from './EventCard';
import type { RegistrationRibbon } from '@cultuvilla/shared/models/event/RegistrationRibbonModel';

// The real catalog, so a renamed or missing key fails here rather than shipping
// the raw key string onto a card.
const { t } = createI18n({ es: getMessages('es') }, 'es');

describe('registrationRibbonProps', () => {
  const cases: [string, RegistrationRibbon, { tone: string; lines: string[] }][] = [
    [
      'one confirmed',
      { kind: 'confirmed', count: 1 },
      { tone: 'accent', lines: ['Apuntado'] },
    ],
    [
      'three confirmed',
      { kind: 'confirmed', count: 3 },
      { tone: 'accent', lines: ['Apuntados ×3'] },
    ],
    [
      'one waitlisted',
      { kind: 'waitlisted', count: 1 },
      { tone: 'secondary', lines: ['En espera'] },
    ],
    [
      'three waitlisted',
      { kind: 'waitlisted', count: 3 },
      { tone: 'secondary', lines: ['En espera ×3'] },
    ],
    [
      'mixed',
      { kind: 'mixed', confirmed: 2, waitlisted: 1 },
      { tone: 'split', lines: ['Apuntado ×2', 'En espera ×1'] },
    ],
  ];

  it.each(cases)('%s', (_label, ribbon, expected) => {
    const props = registrationRibbonProps(ribbon, t);
    expect(props.tone).toBe(expected.tone);
    expect(props.lines).toEqual(expected.lines);
  });

  it('never leaves an unresolved message key on the ribbon', () => {
    for (const [, ribbon] of cases) {
      for (const line of registrationRibbonProps(ribbon, t).lines) {
        expect(line).not.toContain('event.ribbon');
        expect(line).not.toContain('{count}');
      }
    }
  });

  it('gives the mixed state two lines so each count keeps its own status', () => {
    const props = registrationRibbonProps({ kind: 'mixed', confirmed: 1, waitlisted: 1 }, t);
    expect(props.lines).toHaveLength(2);
    expect(props.tone).toBe('split');
  });
});
