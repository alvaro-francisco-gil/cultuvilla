import { render } from '@testing-library/react-native';
import FeedScreen from '../index';
import { getUpcomingFeed } from '@cultuvilla/shared/services/feedService';
import { getAllVillagesFeed } from '@cultuvilla/shared/services/newsService';
import { buildEventData } from '@cultuvilla/shared/models/event/EventDataModel';
import { buildNewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

jest.mock('@cultuvilla/shared', () => ({
  observability: { track: jest.fn() },
  OBSERVABILITY_EVENTS: {},
}));
jest.mock('@cultuvilla/shared/services/feedService', () => ({
  getUpcomingFeed: jest.fn().mockResolvedValue([]),
  haversineKm: jest.fn().mockReturnValue(0),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getAllVillagesFeed: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getActiveCommunities: jest.fn().mockResolvedValue([]),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => {
  // The real hook runs its callback on focus; running it in an effect (rather
  // than during render, which would loop on the setState inside) is close
  // enough for a mounted screen.
  const react = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => react.useEffect(cb, []),
  };
});
const mockRibbonFor = jest.fn((_eventId: string) => null as unknown);
jest.mock('../../../lib/registrations/MyRegistrationsContext', () => ({
  useMyRegistrations: () => ({ ribbonFor: (id: string) => mockRibbonFor(id), refresh: jest.fn() }),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1' },
    profile: { activeMunicipalityId: 'mun1' },
    profileChecked: true,
  }),
}));
jest.mock('../../../lib/auth/RegisterGateContext', () => ({
  useRegisterGate: () => ({ requireAuth: jest.fn(() => true), pendingIntent: null, clearPending: jest.fn() }),
}));
jest.mock('../../../lib/firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('../../../components/layout/AppHeader', () => ({
  AppHeader: () => null,
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const map: Record<string, string> = {
        'feed.tab.events': 'Eventos',
        'feed.tab.news': 'Artículos',
        'event.ribbon.confirmed': 'Apuntado',
      };
      return map[key] ?? key;
    },
  }),
}));

const event = {
  ...buildEventData({
    title: 'Verbena',
    description: 'x',
    startDate: new Date('2099-06-15T18:00:00Z'),
    location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' },
    organizerUserIds: ['uid-1'],
    organizerOrgIds: [],
    createdBy: 'uid-1',
    municipalityId: 'mun1',
    villageName: 'Sotos de Mayorga',
    villageCoordinates: { lat: 40.4, lng: -3.7 },
  }),
  id: 'event1',
};
const post = {
  ...buildNewsPostData({
    municipalityId: 'mun1',
    createdBy: 'uid-1',
    organizerUserIds: ['uid-1'],
    title: 'Corte de agua',
    body: 'x',
    category: 'fiesta',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }),
  id: 'news1',
};

// The feed's tab order is driven by the module-level TABS array; the toggle
// labels, the pager pages and the default tab all derive from it. These tests
// pin the observable consequences so the three can't silently drift apart.
describe('FeedScreen tab order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRibbonFor.mockReturnValue(null);
    (getUpcomingFeed as jest.Mock).mockResolvedValue({ events: [event] });
    (getAllVillagesFeed as jest.Mock).mockResolvedValue([post]);
  });

  it('shows Eventos before Artículos in the toggle', async () => {
    const { findAllByText } = render(<FeedScreen />);
    const labels = (await findAllByText(/^(Artículos|Eventos)$/)).map((n) => n.props.children);
    expect(labels).toEqual(['Eventos', 'Artículos']);
  });

  it('opens on the Eventos feed and renders its page first', async () => {
    const { findByText, queryByText } = render(<FeedScreen />);
    // The news feed only loads once its tab is active. So the event card showing
    // up with no interaction, while the article card is still absent, pins both
    // halves at once: Eventos is the landing tab, and its page renders first.
    expect(await findByText('Verbena', undefined, { timeout: 5000 })).toBeTruthy();
    expect(queryByText('Corte de agua')).toBeNull();
  });
});

// The ribbon's own states are covered by EventCard.test.tsx; what this pins is
// the wiring — the feed asks the registrations context about each event it
// renders, and hands the answer to the card.
describe('FeedScreen sign-up ribbon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRibbonFor.mockReturnValue(null);
    (getUpcomingFeed as jest.Mock).mockResolvedValue({ events: [event] });
    (getAllVillagesFeed as jest.Mock).mockResolvedValue([]);
  });

  it('marks an event the viewer is signed up for', async () => {
    mockRibbonFor.mockReturnValue({ kind: 'confirmed', count: 1 });
    const { findByText } = render(<FeedScreen />);
    expect(await findByText('Apuntado', undefined, { timeout: 5000 })).toBeTruthy();
    expect(mockRibbonFor).toHaveBeenCalledWith('event1');
  });

  it('leaves an event the viewer has no registrations on unmarked', async () => {
    const { findByText, queryByText } = render(<FeedScreen />);
    await findByText('Verbena', undefined, { timeout: 5000 });
    expect(queryByText('Apuntado')).toBeNull();
  });
});
