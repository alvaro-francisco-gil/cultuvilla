import { render } from '@testing-library/react-native';
import VillageTabScreen from '../village';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import {
  buildMunicipalityData,
  buildVillageCommunity,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn(),
  getBarrios: jest.fn().mockResolvedValue([]),
  getPlaces: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn().mockResolvedValue(false),
  getVillageMembers: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getMyOrganizerRequests: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({
  getVillageViewLink: jest.fn().mockReturnValue('https://example.test'),
  getVillageInviteLink: jest.fn().mockReturnValue('https://example.test'),
}));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({
  useShareDeepLink: () => jest.fn(),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1' },
    profile: { activeMunicipalityId: 'mun1' },
    profileChecked: true,
  }),
}));
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({
  useIsAppAdmin: () => ({ isAppAdmin: false }),
}));
jest.mock('../../../lib/firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../components/layout/AppHeader', () => ({
  AppHeader: () => null,
}));
jest.mock('../../../components/feature/VillageDiscovery', () => ({
  VillageDiscovery: () => null,
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const map: Record<string, string> = {
        'village.hub.events': 'Eventos',
        'village.hub.organizations': 'Organizaciones',
        'village.hub.censo': 'Censo',
        'village.hub.news': 'Anuncios',
        'village.notRegistered.body': 'Este pueblo aún no está registrado en Cultuvilla.',
        'village.notRegistered.cta': '¿Te gustaría serlo?',
        'village.notRegistered.button': 'Quiero ser administrador',
        'village.notRegistered.pending': 'Tu solicitud está pendiente de revisión',
        'village.admin.open': 'Administrar pueblo',
      };
      return map[key] ?? key;
    },
  }),
}));

const base = buildMunicipalityData({
  name: 'Sotos de Mayorga',
  province: 'Valladolid',
  comunidadAutonoma: 'Castilla y León',
  codigoINE: '47001',
});
const activeMuni = {
  ...base,
  id: 'mun1',
  communityActive: true,
  community: buildVillageCommunity({ description: 'x', adminUserId: 'admin-1' }),
};
const inactiveMuni = { ...base, id: 'mun1' }; // communityActive: false, community: null

describe('VillageTabScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the village page when the community is active', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeMuni);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    // Active community renders the redesigned village page (hero + sections);
    // the inactive organizer CTA must not appear. The active page resolves
    // several chained service calls, so allow a generous find timeout.
    expect(await findByText('Sotos de Mayorga', undefined, { timeout: 5000 })).toBeTruthy();
    expect(queryByText('Quiero ser administrador')).toBeNull();
  });

  it('shows the organizer CTA when the community is inactive and no request is pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(inactiveMuni);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(await findByText('Quiero ser administrador')).toBeTruthy();
    // "Organizaciones" only renders in the active village page, not the CTA.
    expect(queryByText('Organizaciones')).toBeNull();
  });

  it('shows pending status when an organizer request is already pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(inactiveMuni);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([
      { id: 'r1', userId: 'uid-1', municipalityId: 'mun1', status: 'pending' },
    ]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(await findByText('Tu solicitud está pendiente de revisión')).toBeTruthy();
    expect(queryByText('Quiero ser administrador')).toBeNull();
  });
});
