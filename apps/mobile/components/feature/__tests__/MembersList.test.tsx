import { render, screen, waitFor } from '@testing-library/react-native';
import { MembersList } from '../MembersList';

const mockGetVillageMembers = jest.fn();
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMembers: (...a: unknown[]) => mockGetVillageMembers(...a),
}));

const mockGetUserProfile = jest.fn();
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
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
  user1: { displayName: 'Bruno Vecino', photoURL: null },
};

beforeEach(() => {
  mockGetVillageMembers.mockReset();
  mockGetUserProfile.mockReset();
  mockGetUserProfile.mockImplementation(async (uid: string) => profiles[uid] ?? null);
});

test('renders each member with name, role badge and censo status', async () => {
  mockGetVillageMembers.mockResolvedValue([
    { id: 'admin1', userId: 'admin1', role: 'admin', joinedAt: new Date('2026-01-01'), profileCompletedAt: new Date('2026-01-02') },
    { id: 'user1', userId: 'user1', role: 'user', joinedAt: new Date('2026-02-01'), profileCompletedAt: null },
  ]);

  render(<MembersList villageId="m1" />);

  await waitFor(() => expect(screen.getByText('Ana Admin')).toBeTruthy());
  expect(screen.getByText('Bruno Vecino')).toBeTruthy();
  expect(screen.getByText('Administrador')).toBeTruthy();
  expect(screen.getByText('Miembro')).toBeTruthy();
  expect(screen.getByText('Censo completo')).toBeTruthy();
  expect(screen.getByText('Censo pendiente')).toBeTruthy();
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
