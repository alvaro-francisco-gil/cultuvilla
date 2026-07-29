import { render, waitFor } from '@testing-library/react-native';
import { PersonProfileView } from '../PersonProfileView';

const mockGetMunicipality = jest.fn();
const mockGetBarrio = jest.fn();
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: (...a: unknown[]) => mockGetMunicipality(...a),
  getBarrio: (...a: unknown[]) => mockGetBarrio(...a),
}));

// Real Spanish catalog so the infobox labels are asserted as the user sees them.
jest.mock('../../../../lib/i18n', () => {
  const { getMessages } = jest.requireActual('@cultuvilla/i18n');
  const es = getMessages('es');
  const resolve = (k: string): unknown =>
    k.split('.').reduce<unknown>((o, seg) => (o == null ? undefined : (o as Record<string, unknown>)[seg]), es);
  return {
    useT: () => ({
      locale: 'es',
      t: (k: string) => (typeof resolve(k) === 'string' ? (resolve(k) as string) : k),
    }),
  };
});

const person = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    givenName: 'Marta',
    middleNames: [],
    firstSurname: 'Prieto',
    secondSurname: null,
    nickname: null,
    sex: null,
    birthday: null,
    deathDate: null,
    birthPlace: null,
    burialPlace: null,
    municipalityLinks: [],
    occupations: [],
    biography: null,
    photoURL: null,
    userId: null,
    isPublic: true,
    createdBy: 'u1',
    createdAt: new Date(),
    ...over,
  }) as Parameters<typeof PersonProfileView>[0]['person'];

beforeEach(() => {
  mockGetMunicipality.mockReset();
  mockGetBarrio.mockReset();
  mockGetMunicipality.mockImplementation(async (id: string) =>
    ({ m1: { id: 'm1', name: 'Anaya' }, m2: { id: 'm2', name: 'Segovia' } })[id] ?? null,
  );
  mockGetBarrio.mockResolvedValue({ id: 'b1', name: 'Centro' });
});

test('shows birthplace, pueblo and oficios as infobox rows', async () => {
  const { findByText, getByText } = render(
    <PersonProfileView
      person={person({
        birthPlace: { municipalityId: 'm2', barrioId: null },
        municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b1' }],
        occupations: ['panadero', 'Malabarista'],
      })}
    />,
  );

  expect(await findByText('Segovia')).toBeTruthy();
  getByText('Nacimiento');
  getByText('Pueblo');
  getByText('Anaya · Centro');
  getByText('Oficios');
});

test('joins several oficios into one line instead of separate chips', async () => {
  const { findByText } = render(
    <PersonProfileView person={person({ occupations: ['Panadera', 'Costurera'] })} />,
  );

  expect(await findByText('Panadera, Costurera')).toBeTruthy();
});

test('renders no infobox at all when nothing is known', async () => {
  const { queryByText, getByText } = render(
    <PersonProfileView person={person({ biography: 'Vive aquí' })} />,
  );

  getByText('Vive aquí');
  await waitFor(() => expect(queryByText('Nacimiento')).toBeNull());
  expect(queryByText('Pueblo')).toBeNull();
  expect(queryByText('Oficios')).toBeNull();
});

test('omits a place whose municipality doc has gone missing', async () => {
  mockGetMunicipality.mockResolvedValue(null);

  const { queryByText, findByText } = render(
    <PersonProfileView
      person={person({
        birthPlace: { municipalityId: 'gone', barrioId: null },
        municipalityLinks: [{ municipalityId: 'gone', barrioId: null }],
        occupations: ['Panadera'],
      })}
    />,
  );

  // The oficios row still renders; the unresolvable places are dropped rather
  // than shown as raw ids.
  expect(await findByText('Panadera')).toBeTruthy();
  expect(queryByText('gone')).toBeNull();
  expect(queryByText('Nacimiento')).toBeNull();
});
