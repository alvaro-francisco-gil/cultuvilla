import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { MembershipVillageEditor } from '../MembershipVillageEditor';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ profile: { activeMunicipalityId: 'm1' } }),
}));

// babel-plugin-jest-hoist only allows out-of-scope references from `jest.mock`
// factories for identifiers prefixed with "mock" (case-insensitive) — see
// VillageDiscovery.test.tsx for the established pattern in this repo.
const mockGetUserMemberships = jest.fn();
const mockLeaveVillage = jest.fn().mockResolvedValue(undefined);
const mockEnsureVillageMembership = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: (...a: unknown[]) => mockGetUserMemberships(...a),
  leaveVillage: (...a: unknown[]) => mockLeaveVillage(...a),
  ensureVillageMembership: (...a: unknown[]) => mockEnsureVillageMembership(...a),
}));
const mockGetPersonByUserId = jest.fn();
const mockUpdateResidenceBarrio = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: (...a: unknown[]) => mockGetPersonByUserId(...a),
  updateResidenceBarrio: (...a: unknown[]) => mockUpdateResidenceBarrio(...a),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({ name: 'Villa Uno' }),
  getBarrios: jest.fn().mockResolvedValue([]),
  searchMunicipalities: jest.fn().mockResolvedValue([]),
}));
const mockSetActiveMunicipality = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/userService', () => ({
  setActiveMunicipality: (...a: unknown[]) => mockSetActiveMunicipality(...a),
}));
jest.mock('@cultuvilla/shared/models/municipality', () => ({ escudoThumbDisplayUrl: () => null }));

beforeEach(() => {
  mockGetUserMemberships.mockReset();
  mockGetPersonByUserId.mockReset();
  mockLeaveVillage.mockClear();
  mockSetActiveMunicipality.mockClear();
  Platform.OS = 'web';
  // jsdom isn't loaded in this jest env, so window has no confirm to spy on —
  // install the mock directly (mirrors DeleteHeaderButton.test.tsx).
  (globalThis as unknown as { window: { confirm: () => boolean } }).window = {
    ...(globalThis as unknown as { window?: object }).window,
    confirm: jest.fn().mockReturnValue(true),
  } as never;
});

it('renders one leave button per joined village', async () => {
  mockGetUserMemberships.mockResolvedValue([{ municipalityId: 'm1', role: 'user', joinedAt: new Date(), profileCompletedAt: null }]);
  mockGetPersonByUserId.mockResolvedValue({ municipalityLinks: [{ municipalityId: 'm1', barrioId: null }] });
  const { getAllByLabelText } = render(<MembershipVillageEditor userId="u1" />);
  await waitFor(() => expect(getAllByLabelText('profile.personForm.removeVillage')).toHaveLength(1));
});

it('leaves the village and reassigns active on confirm', async () => {
  mockGetUserMemberships.mockResolvedValue([
    { municipalityId: 'm1', role: 'user', joinedAt: new Date(), profileCompletedAt: null },
    { municipalityId: 'm2', role: 'user', joinedAt: new Date(), profileCompletedAt: null },
  ]);
  mockGetPersonByUserId.mockResolvedValue({ municipalityLinks: [] });
  const { getAllByLabelText } = render(<MembershipVillageEditor userId="u1" />);
  await waitFor(() => expect(getAllByLabelText('profile.personForm.removeVillage').length).toBe(2));
  fireEvent.press(getAllByLabelText('profile.personForm.removeVillage')[0]!);
  await waitFor(() => expect(mockLeaveVillage).toHaveBeenCalledWith('m1', 'u1'));
  // m1 was active → reassign to the remaining membership.
  await waitFor(() => expect(mockSetActiveMunicipality).toHaveBeenCalledWith('u1', 'm2'));
});
