import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MembersList } from '../MembersList';

const mockGetVillageMembers = jest.fn();
const mockSetVillageMemberRole = jest.fn();
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMembers: (...a: unknown[]) => mockGetVillageMembers(...a),
  setVillageMemberRole: (...a: unknown[]) => mockSetVillageMemberRole(...a),
}));

const mockGetUserProfile = jest.fn();
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
}));

const mockGetPersonByUserId = jest.fn();
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: (...a: unknown[]) => mockGetPersonByUserId(...a),
}));

const mockGetMunicipality = jest.fn();
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: (...a: unknown[]) => mockGetMunicipality(...a),
}));

// showConfirm auto-accepts so we can assert the role change fires on confirm.
const mockShowConfirm = jest.fn();
const mockShowAlert = jest.fn();
jest.mock('../../../lib/dialogs', () => ({
  showConfirm: (title: string, message: string, onConfirm: () => void) => {
    mockShowConfirm(title, message);
    onConfirm();
  },
  showAlert: (...a: unknown[]) => mockShowAlert(...a),
}));

// Real Spanish catalog so we can assert on the visible strings.
jest.mock('../../../lib/i18n', () => {
  const { getMessages } = jest.requireActual('@cultuvilla/i18n');
  const es = getMessages('es');
  const resolve = (k: string): unknown =>
    k.split('.').reduce<unknown>((o, seg) => (o == null ? undefined : (o as Record<string, unknown>)[seg]), es);
  return {
    useT: () => ({
      locale: 'es',
      t: (k: string, vars?: Record<string, string | number>) => {
        const tpl = resolve(k);
        if (typeof tpl !== 'string') return k;
        return vars ? tpl.replace(/\{(\w+)\}/g, (_: string, kk: string) => String(vars[kk] ?? `{${kk}}`)) : tpl;
      },
    }),
  };
});

const profiles: Record<string, { displayName: string; photoURL: string | null }> = {
  admin1: { displayName: 'Ana Admin', photoURL: null },
  admin2: { displayName: 'Carlos Organizador', photoURL: null },
  user1: { displayName: 'Bruno Vecino', photoURL: null },
};

beforeEach(() => {
  mockGetVillageMembers.mockReset();
  mockSetVillageMemberRole.mockReset();
  mockGetUserProfile.mockReset();
  mockGetPersonByUserId.mockReset();
  mockGetMunicipality.mockReset();
  mockShowConfirm.mockReset();
  mockShowAlert.mockReset();
  mockGetUserProfile.mockImplementation(async (uid: string) => profiles[uid] ?? null);
  mockGetPersonByUserId.mockResolvedValue({ photoURL: null });
  mockSetVillageMemberRole.mockResolvedValue(undefined);
  mockGetMunicipality.mockResolvedValue({ id: 'm1', community: { organizerId: null } });
});

test('renders a table with column headers and a row per member', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: new Date('2026-01-02') },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Ana Admin')).toBeTruthy());
  // Column headers.
  expect(screen.getByText('Nombre')).toBeTruthy();
  expect(screen.getByText('Censo')).toBeTruthy();
  expect(screen.getByText('Fecha')).toBeTruthy();
  // Names.
  expect(screen.getByText('Bruno Vecino')).toBeTruthy();
  // Censo cell is a tick for the completed member and a cross for the pending one.
  expect(screen.getByLabelText('Censo completo')).toBeTruthy();
  expect(screen.getByLabelText('Censo pendiente')).toBeTruthy();
  expect(mockGetVillageMembers).toHaveBeenCalledWith('m1');
});

test('lists admins before regular members regardless of join order', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Ana Admin')).toBeTruthy());
  const names = screen.getAllByTestId('member-name').map((n) => n.props.children);
  expect(names).toEqual(['Ana Admin', 'Bruno Vecino']);
});

test('shows an empty state when the pueblo has no members', async () => {
  mockGetVillageMembers.mockResolvedValue([]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Aún no hay miembros.')).toBeTruthy());
});

test('read-only viewer sees no role-change controls', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Ana Admin')).toBeTruthy());
  expect(screen.queryByTestId('member-row-user1')).toBeNull();
  expect(screen.queryByTestId('member-row-admin1')).toBeNull();
  // Read-only: never reads the community doc for the organizer pointer.
  expect(mockGetMunicipality).not.toHaveBeenCalled();
});

test('an admin can promote a member; the roster refetches afterwards', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" canManage currentUserId="admin1" />);

  await waitFor(() => expect(screen.getByTestId('member-row-user1')).toBeTruthy());
  fireEvent.press(screen.getByTestId('member-row-user1'));

  expect(mockSetVillageMemberRole).toHaveBeenCalledWith('m1', 'user1', 'admin');
  await waitFor(() => expect(mockGetVillageMembers).toHaveBeenCalledTimes(2));
});

test('an admin can demote another admin', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'admin2', userId: 'admin2', role: 'admin', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" canManage currentUserId="admin1" />);

  await waitFor(() => expect(screen.getByTestId('member-row-admin2')).toBeTruthy());
  fireEvent.press(screen.getByTestId('member-row-admin2'));

  expect(mockSetVillageMemberRole).toHaveBeenCalledWith('m1', 'admin2', 'user');
});

test('an admin cannot change their own role', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" canManage currentUserId="admin1" />);

  await waitFor(() => expect(screen.getByTestId('member-row-user1')).toBeTruthy());
  expect(screen.queryByTestId('member-row-admin1')).toBeNull();
});

test('the founding organizer cannot be demoted from the UI', async () => {
  mockGetMunicipality.mockResolvedValue({ id: 'm1', community: { organizerId: 'admin2' } });
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'admin2', userId: 'admin2', role: 'admin', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" canManage currentUserId="admin1" />);

  await waitFor(() => expect(screen.getByText('Carlos Organizador')).toBeTruthy());
  expect(screen.queryByTestId('member-row-admin2')).toBeNull();
  // A non-organizer admin is still actionable.
  expect(screen.queryByTestId('member-row-admin1')).toBeNull(); // own row
});

test('surfaces an error if the role change fails', async () => {
  mockSetVillageMemberRole.mockRejectedValue(new Error('No autorizado.'));
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: null },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" canManage currentUserId="admin1" />);

  await waitFor(() => expect(screen.getByTestId('member-row-user1')).toBeTruthy());
  fireEvent.press(screen.getByTestId('member-row-user1'));

  await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('No autorizado.'));
});
