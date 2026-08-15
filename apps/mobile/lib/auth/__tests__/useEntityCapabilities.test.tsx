import { renderHook, waitFor } from '@testing-library/react-native';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useEntityCapabilities } from '../useEntityCapabilities';
import { useAuth } from '../useAuth';
import { useIsAppAdmin } from '../useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(),
}));
jest.mock('../useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockAppAdmin = useIsAppAdmin as jest.Mock;
const mockIsVillageAdmin = isVillageAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'alice' }, loading: false });
  mockAppAdmin.mockReturnValue({ isAppAdmin: false, loading: false });
  mockIsVillageAdmin.mockResolvedValue(false);
});

async function caps() {
  const { result } = renderHook(() => useEntityCapabilities('m1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('useEntityCapabilities', () => {
  it('plain member: cannot manage, exposes uid', async () => {
    const result = await caps();
    expect(result.current.canManage).toBe(false);
    expect(result.current.canApprove).toBe(false);
    expect(result.current.uid).toBe('alice');
  });

  it('village admin: can manage and approve', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const result = await caps();
    expect(result.current.canManage).toBe(true);
    expect(result.current.canApprove).toBe(true);
  });

  it('app admin: can manage without a village-admin record', async () => {
    mockAppAdmin.mockReturnValue({ isAppAdmin: true, loading: false });
    const result = await caps();
    expect(result.current.canManage).toBe(true);
  });

  it('unauthenticated: resolves not-loading, cannot manage, uid null', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const result = await caps();
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBeNull();
  });
});

// Mirrors the `allow update` clause shared by places / barrios / festivalPosters:
// village admin OR app admin OR the doc's creator.
describe('useEntityCapabilities.canEdit', () => {
  it('creator can edit their own creation without being an admin', async () => {
    const result = await caps();
    expect(result.current.canEdit('alice')).toBe(true);
  });

  it('plain member cannot edit someone else’s creation', async () => {
    const result = await caps();
    expect(result.current.canEdit('bob')).toBe(false);
  });

  it('village admin can edit anything, including creator-less docs', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const result = await caps();
    expect(result.current.canEdit('bob')).toBe(true);
    expect(result.current.canEdit(null)).toBe(true);
  });

  it('a null/undefined creator never matches a signed-out viewer', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const result = await caps();
    expect(result.current.canEdit(null)).toBe(false);
    expect(result.current.canEdit(undefined)).toBe(false);
  });

  // Events and news additionally name an organizer set; the other kinds pass none.
  it('a named organizer can edit a post they did not author', async () => {
    const result = await caps();
    expect(result.current.canEdit('bob', ['carol', 'alice'])).toBe(true);
  });

  it('someone outside the organizer set still cannot edit', async () => {
    const result = await caps();
    expect(result.current.canEdit('bob', ['carol'])).toBe(false);
  });

  it('an empty organizer set grants nothing on its own', async () => {
    const result = await caps();
    expect(result.current.canEdit('bob', [])).toBe(false);
  });

  it('a signed-out viewer matches no organizer set', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const result = await caps();
    expect(result.current.canEdit('bob', ['alice'])).toBe(false);
  });
});

// Mirrors the `allow delete` clause: admins always; the creator only while the
// doc is still `active` (hiding it is a moderation act the author can't undo).
describe('useEntityCapabilities.canDelete', () => {
  it('creator can withdraw their own active creation', async () => {
    const result = await caps();
    expect(result.current.canDelete('alice', 'active')).toBe(true);
  });

  it('creator cannot delete their creation once it has been hidden', async () => {
    const result = await caps();
    expect(result.current.canDelete('alice', 'hidden')).toBe(false);
  });

  it('plain member cannot delete someone else’s creation', async () => {
    const result = await caps();
    expect(result.current.canDelete('bob', 'active')).toBe(false);
  });

  it('village admin can delete regardless of status', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const result = await caps();
    expect(result.current.canDelete('bob', 'hidden')).toBe(true);
  });
});
