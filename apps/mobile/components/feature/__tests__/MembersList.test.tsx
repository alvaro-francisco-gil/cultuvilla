import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MembersList } from '../MembersList';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const mockGetVillageMembers = jest.fn();
const mockSetVillageMemberRole = jest.fn();
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMembers: (...a: unknown[]) => mockGetVillageMembers(...a),
  setVillageMemberRole: (...a: unknown[]) => mockSetVillageMemberRole(...a),
}));

const mockGetMunicipalityPeople = jest.fn();
jest.mock('@cultuvilla/shared/services/municipalityPersonService', () => ({
  getMunicipalityPeople: (...a: unknown[]) => mockGetMunicipalityPeople(...a),
}));

const mockGetMunicipality = jest.fn();
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: (...a: unknown[]) => mockGetMunicipality(...a),
}));

const mockShowConfirm = jest.fn();
jest.mock('../../../lib/dialogs', () => ({
  showConfirm: (_title: string, _message: string, onConfirm: () => void) => {
    mockShowConfirm();
    onConfirm();
  },
  showAlert: jest.fn(),
}));

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ t: (key: string) => ({
    'village.membersList.colName': 'Nombre',
    'village.membersList.colCenso': 'Censo',
    'village.membersList.censoComplete': 'Censo completo',
    'village.membersList.censoPending': 'Censo pendiente',
    'village.membersList.empty': 'Aún no hay personas registradas.',
  }[key] ?? key) }),
}));

const people = [
  { id: 'm1_p1', personId: 'p1', municipalityId: 'm1', displayName: 'Álvaro Vecino', sortName: 'alvaro vecino', photoURL: null, userId: 'user1' },
  { id: 'm1_p2', personId: 'p2', municipalityId: 'm1', displayName: 'Bea A Cargo', sortName: 'bea a cargo', photoURL: null, userId: null },
];

beforeEach(() => {
  mockGetVillageMembers.mockReset();
  mockGetMunicipalityPeople.mockReset();
  mockGetMunicipality.mockReset();
  mockSetVillageMemberRole.mockReset();
  mockShowConfirm.mockReset();
  mockPush.mockReset();
  mockGetMunicipalityPeople.mockResolvedValue(people);
  mockGetVillageMembers.mockResolvedValue([
    { userId: 'user1', role: 'user', profileCompletedAt: null },
  ]);
  mockGetMunicipality.mockResolvedValue({ id: 'm1', community: { organizerId: null, profileForm: null } });
  mockSetVillageMemberRole.mockResolvedValue(undefined);
});

test('renders account and dependent personas in the directory order', async () => {
  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Álvaro Vecino')).toBeTruthy());
  expect(screen.getByText('Bea A Cargo')).toBeTruthy();
  expect(screen.getAllByTestId('member-name').map((node) => node.props.children))
    .toEqual(['Álvaro Vecino', 'Bea A Cargo']);
  expect(mockGetMunicipalityPeople).toHaveBeenCalledWith('m1');
});

test('shows censo only for account-linked people when configured', async () => {
  mockGetMunicipality.mockResolvedValue({
    id: 'm1',
    community: { organizerId: null, profileForm: { fields: [{ key: 'age' }] } },
  });
  mockGetVillageMembers.mockResolvedValue([
    { userId: 'user1', role: 'user', profileCompletedAt: new Date() },
  ]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByLabelText('Censo completo')).toBeTruthy());
  expect(screen.queryByLabelText('Censo pendiente')).toBeNull();
});

test('only an account member is actionable for an admin', async () => {
  render(<MembersList villageId="m1" canManage currentUserId="admin" />);

  await waitFor(() => expect(screen.getByTestId('member-row-user1')).toBeTruthy());
  expect(screen.queryByTestId('member-row-')).toBeNull();
  fireEvent.press(screen.getByTestId('member-row-user1'));
  expect(mockSetVillageMemberRole).toHaveBeenCalledWith('m1', 'user1', 'admin');
});

test('opens the linked user profile from the name or avatar area', async () => {
  render(<MembersList villageId="m1" />);
  await waitFor(() => expect(screen.getByTestId('person-profile-p1')).toBeTruthy());
  fireEvent.press(screen.getByTestId('person-profile-p1'));
  expect(mockPush).toHaveBeenCalledWith('/user/user1');
});

test('opens a dependent persona profile when no user account is linked', async () => {
  render(<MembersList villageId="m1" />);
  await waitFor(() => expect(screen.getByTestId('person-profile-p2')).toBeTruthy());
  fireEvent.press(screen.getByTestId('person-profile-p2'));
  expect(mockPush).toHaveBeenCalledWith('/person/p2');
});

test('shows the people empty state', async () => {
  mockGetMunicipalityPeople.mockResolvedValue([]);
  render(<MembersList villageId="m1" />);
  await waitFor(() => expect(screen.getByText('Aún no hay personas registradas.')).toBeTruthy());
});
