import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ResidenceLinksEditor } from '../ResidenceLinksEditor';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));

// babel-plugin-jest-hoist only allows out-of-scope references from `jest.mock`
// factories for identifiers prefixed with "mock" — the pattern used across
// these tests (see MembershipVillageEditor.test.tsx).
jest.mock('@cultuvilla/shared/services/municipalityService', () => {
  // Declared inside the factory: `jest.mock` is hoisted above the module's own
  // top-level consts, so an outer array would still be in its TDZ here.
  const villages = [
    { id: 'm1', name: 'Villa Uno', province: 'Soria' },
    { id: 'm2', name: 'Villa Dos', province: 'Soria' },
  ];
  return {
    searchMunicipalities: () => Promise.resolve(villages),
    getMunicipality: (id: string) => Promise.resolve(villages.find((m) => m.id === id) ?? null),
    getBarrios: () => Promise.resolve([]),
  };
});
jest.mock('@cultuvilla/shared/models/municipality', () => ({ escudoThumbDisplayUrl: () => null }));

const WAIT = { timeout: 3000 };

it('hides a village already used by another row — one barrio per village', async () => {
  // The reported bug: a dependent persona could be given two barrios of the
  // SAME village, which the municipalityPeople projection cannot represent
  // (one row per municipality+person) while syncBarrioResidentCount counts both.
  const { getByText, queryByText, findByText } = render(
    <ResidenceLinksEditor
      value={[
        { municipalityId: 'm1', barrioId: 'b1' },
        { municipalityId: '', barrioId: null },
      ]}
      onChange={jest.fn()}
    />,
  );

  // Let row 0's trigger resolve its village name first, so the only remaining
  // "Sin pueblo" in the tree is row 1's unfilled trigger.
  await findByText('Villa Uno (Soria)', {}, WAIT);
  fireEvent.press(getByText('Sin pueblo'));

  // It may pick any village EXCEPT the one row 0 already holds.
  expect(await findByText('Villa Dos', {}, WAIT)).toBeTruthy();
  await waitFor(() => expect(queryByText('Villa Uno')).toBeNull(), WAIT);
});

it('still offers the row its own current village so the selection stays visible', async () => {
  const { findByText } = render(
    <ResidenceLinksEditor
      value={[
        { municipalityId: 'm1', barrioId: 'b1' },
        { municipalityId: 'm2', barrioId: null },
      ]}
      onChange={jest.fn()}
    />,
  );

  fireEvent.press(await findByText('Villa Uno (Soria)', {}, WAIT));

  // The list must still offer m1 — excluding a row's own value would make its
  // current selection unreachable when re-opening the picker.
  expect(await findByText('Villa Uno', {}, WAIT)).toBeTruthy();
});
