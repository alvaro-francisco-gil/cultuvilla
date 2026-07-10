import { render, fireEvent } from '@testing-library/react-native';
import VillageTabScreen from '../village';
import { getMunicipality, getBarrios, getPlaces } from '@cultuvilla/shared/services/municipalityService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { router } from 'expo-router';
import {
  buildMunicipalityData,
  buildVillageCommunity,
  buildBarrioData,
  buildPlaceData,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import { buildOrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { buildFestivalPosterData } from '@cultuvilla/shared/models/festivalPoster/FestivalPosterDataModel';
import { getFestivalPosters } from '@cultuvilla/shared/services/festivalPosterService';

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
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMemberCount: jest.fn().mockResolvedValue(0),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getBarrioResidentCount: jest.fn().mockResolvedValue(0),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getHomeFeed: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPosters: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getMyOrganizerRequests: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({
  getVillageViewLink: jest.fn().mockReturnValue('https://example.test'),
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
        'village.noOrganizer.body': 'Este pueblo todavía no tiene administrador.',
        'village.noOrganizer.cta': 'Administrar este pueblo',
        'village.noOrganizer.pending': 'Tu solicitud de administrador está pendiente de revisión',
        'village.admin.open': 'Administrar pueblo',
        'village.festivalPosters.title': 'Carteles de fiestas',
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
  community: buildVillageCommunity({ description: 'x', organizerId: 'admin-1' }),
};
// Active but "started" — no organizer granted yet (organizerId === null).
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
    expect(queryByText('Administrar este pueblo')).toBeNull();
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
    expect(await findByText('Administrar este pueblo')).toBeTruthy();
  });

  it('shows the pending status when an organizer request is already pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeNoOrganizer);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([
      { id: 'r1', userId: 'uid-1', municipalityId: 'mun1', status: 'pending' },
    ]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(
      await findByText('Tu solicitud de administrador está pendiente de revisión'),
    ).toBeTruthy();
    expect(queryByText('Administrar este pueblo')).toBeNull();
  });

  describe('card navigation (non-admin viewer)', () => {
    const barrio = { ...buildBarrioData({ name: 'El Barrio', municipalityId: 'mun1' }), id: 'barrio1' };
    const place = { ...buildPlaceData({ name: 'La Iglesia', kind: 'church', municipalityId: 'mun1' }), id: 'place1' };
    const agrupacion = {
      ...buildOrganizationData({ name: 'Ayuntamiento', type: 'ayuntamiento', municipalityId: 'mun1', requestedBy: 'uid-1', status: 'approved' }),
      id: 'org1',
    };
    const pena = {
      ...buildOrganizationData({ name: 'Peña La Juerga', type: 'peña', municipalityId: 'mun1', requestedBy: 'uid-1', status: 'approved' }),
      id: 'org2',
    };

    beforeEach(() => {
      (getMunicipality as jest.Mock).mockResolvedValue(activeMuni);
      (getBarrios as jest.Mock).mockResolvedValue([barrio]);
      (getPlaces as jest.Mock).mockResolvedValue([place]);
      (getOrganizationsByMunicipality as jest.Mock).mockResolvedValue([agrupacion, pena]);
    });

    it('tapping a barrio card pushes the barrio detail route', async () => {
      const { findByText } = render(<VillageTabScreen />);
      fireEvent.press(await findByText('El Barrio', undefined, { timeout: 5000 }));
      expect(router.push).toHaveBeenCalledWith('/village/mun1/barrio/barrio1');
    });

    it('tapping a lugar card pushes the place detail route', async () => {
      const { findByText } = render(<VillageTabScreen />);
      fireEvent.press(await findByText('La Iglesia', undefined, { timeout: 5000 }));
      expect(router.push).toHaveBeenCalledWith('/village/mun1/place/place1');
    });

    it('tapping an agrupación card pushes the org detail route', async () => {
      const { findByText } = render(<VillageTabScreen />);
      fireEvent.press(await findByText('Ayuntamiento', undefined, { timeout: 5000 }));
      expect(router.push).toHaveBeenCalledWith('/o/org1');
    });

    it('tapping a peña card pushes the org detail route', async () => {
      const { findByText } = render(<VillageTabScreen />);
      fireEvent.press(await findByText('Peña La Juerga', undefined, { timeout: 5000 }));
      expect(router.push).toHaveBeenCalledWith('/o/org2');
    });
  });

  describe('festival posters section', () => {
    const poster = {
      ...buildFestivalPosterData({
        municipalityId: 'mun1',
        year: 2024,
        title: 'San Roque',
        createdAt: new Date('2024-01-01'),
      }),
      id: 'poster1',
    };

    beforeEach(() => {
      (getMunicipality as jest.Mock).mockResolvedValue(activeMuni);
      (getFestivalPosters as jest.Mock).mockResolvedValue([poster]);
    });

    it('renders the carteles de fiestas section with the poster year', async () => {
      const { findByText } = render(<VillageTabScreen />);
      expect(
        await findByText('Carteles de fiestas', undefined, { timeout: 5000 }),
      ).toBeTruthy();
      expect(await findByText('2024')).toBeTruthy();
    });

    it('hides the section entirely when there are no posters', async () => {
      (getFestivalPosters as jest.Mock).mockResolvedValue([]);
      // Wait for the page to settle (the escudo/name renders regardless), then
      // assert the empty section is gone — content is created from the "Añadir
      // contenido" sheet, so an empty scroll no longer appears.
      const { findByText, queryByText } = render(<VillageTabScreen />);
      await findByText('Sotos de Mayorga', undefined, { timeout: 5000 });
      expect(queryByText('Carteles de fiestas')).toBeNull();
    });
  });
});
