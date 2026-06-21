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
        'village.notRegistered.body': 'Este pueblo todavía no está activo en Cultuvilla.',
        'village.notRegistered.cta': '¿Quieres iniciarlo?',
        'village.notRegistered.button': 'Iniciar este pueblo',
        'village.noOrganizer.body': 'Este pueblo todavía no tiene organizador.',
        'village.noOrganizer.cta': 'Organizar este pueblo',
        'village.noOrganizer.pending': 'Tu solicitud de organizador está pendiente de revisión',
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
// Active but "started" — no organizer granted yet (adminUserId === null).
const activeNoOrganizer = {
  ...base,
  id: 'mun1',
  communityActive: true,
  community: buildVillageCommunity({ description: 'x' }),
};
const inactiveMuni = { ...base, id: 'mun1' }; // communityActive: false, community: null

describe('VillageTabScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the village page when the community is active and has an organizer', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeMuni);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    // Active community renders the redesigned village page (hero + sections);
    // neither the start CTA nor the no-organizer banner must appear.
    expect(await findByText('Sotos de Mayorga', undefined, { timeout: 5000 })).toBeTruthy();
    expect(queryByText('Iniciar este pueblo')).toBeNull();
    expect(queryByText('Organizar este pueblo')).toBeNull();
  });

  it('shows the "start this village" CTA when the community is inactive', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(inactiveMuni);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(await findByText('Iniciar este pueblo')).toBeTruthy();
    // "Organizaciones" only renders on the active village page, not the CTA.
    expect(queryByText('Organizaciones')).toBeNull();
  });

  it('shows the organize CTA when active but with no organizer and no pending request', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeNoOrganizer);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([]);
    const { findByText } = render(<VillageTabScreen />);
    expect(await findByText('Organizar este pueblo')).toBeTruthy();
  });

  it('shows the pending status when an organizer request is already pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeNoOrganizer);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([
      { id: 'r1', userId: 'uid-1', municipalityId: 'mun1', status: 'pending' },
    ]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(
      await findByText('Tu solicitud de organizador está pendiente de revisión'),
    ).toBeTruthy();
    expect(queryByText('Organizar este pueblo')).toBeNull();
  });
});
