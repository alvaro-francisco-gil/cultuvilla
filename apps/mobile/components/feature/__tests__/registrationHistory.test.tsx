import { describeRegistrationEvent } from '../RegistrationHistory';
import { createI18n } from '../../../lib/i18n';
import { getMessages } from '@cultuvilla/i18n';

const { t } = createI18n({ es: getMessages('es') }, 'es');

describe('describeRegistrationEvent', () => {
  it('says the attendee left of their own accord', () => {
    const phrase = describeRegistrationEvent(
      { action: 'cancelled_self', name: 'Lucía', actorUserId: 'lucia' },
      'Lucía Pérez',
      t,
    );
    expect(phrase).toBe('Lucía anuló su inscripción');
  });

  it('names the organizer who removed someone — the whole point of the log', () => {
    const phrase = describeRegistrationEvent(
      { action: 'removed_by_organizer', name: 'Lucía', actorUserId: 'org-1' },
      'Marta la del ayuntamiento',
      t,
    );
    expect(phrase).toBe('Marta la del ayuntamiento quitó a Lucía');
  });

  it('falls back to a neutral actor rather than leaking a raw uid', () => {
    const phrase = describeRegistrationEvent(
      { action: 'removed_by_organizer', name: 'Lucía', actorUserId: 'org-deleted' },
      null,
      t,
    );
    expect(phrase).toBe('Alguien quitó a Lucía');
    expect(phrase).not.toContain('org-deleted');
  });

  it('phrases the system-driven actions without implying anyone acted', () => {
    expect(
      describeRegistrationEvent(
        { action: 'waitlist_promoted', name: 'Luis', actorUserId: '' },
        null,
        t,
      ),
    ).toBe('Luis pasó de la lista de espera a plaza confirmada');
    expect(
      describeRegistrationEvent(
        { action: 'signups_disabled', name: 'Luis', actorUserId: '' },
        null,
        t,
      ),
    ).toBe('Luis salió al desactivarse las inscripciones');
  });

  it('has a phrase for every action the model can record', () => {
    const actions = [
      'signed_up',
      'walk_in_added',
      'seat_claimed',
      'waitlist_promoted',
      'cancelled_self',
      'removed_by_organizer',
      'group_cancelled',
      'seat_released',
      'signups_disabled',
    ] as const;
    for (const action of actions) {
      const phrase = describeRegistrationEvent({ action, name: 'X', actorUserId: 'a' }, 'A', t);
      // A missing key makes the adapter echo the key path back.
      expect(phrase).not.toBe(`event.history.${action}`);
      expect(phrase).toContain('X');
    }
  });
});
