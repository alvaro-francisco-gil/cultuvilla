import { router } from 'expo-router';
import { openOwner } from '../ownerRoute';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({ getOrganization: jest.fn() }));

const push = router.push as jest.Mock;
const getOrg = getOrganization as jest.Mock;

describe('openOwner', () => {
  beforeEach(() => {
    push.mockClear();
    getOrg.mockReset();
  });

  it('opens a user profile', async () => {
    await openOwner('user', 'u1');
    expect(push).toHaveBeenCalledWith('/usuario/u1');
  });

  it('opens a persona', async () => {
    await openOwner('person', 'p1');
    expect(push).toHaveBeenCalledWith('/persona/p1');
  });

  it('resolves an organization to its pueblo-first path', async () => {
    getOrg.mockResolvedValue({ id: 'o1', name: 'Peña El Roble', villageSlug: 'matabuena' });
    await openOwner('organization', 'o1');
    expect(push).toHaveBeenCalledWith('/matabuena/entidad/pena-el-roble_o1');
  });

  it('goes nowhere when the organization is gone', async () => {
    getOrg.mockResolvedValue(null);
    await openOwner('organization', 'missing');
    expect(push).not.toHaveBeenCalled();
  });
});
