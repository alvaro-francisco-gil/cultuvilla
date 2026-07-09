import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { VillageHomeBody } from '../VillageHomeBody';
import type { VillageHomeState } from '../../../lib/useVillageHome';

const mockRefreshProfile = jest.fn(async () => undefined);
jest.mock('../../../lib/auth/useAuth', () => {
  const value = {
    user: { uid: 'u1' },
    profile: null,
    profileChecked: true,
    refreshProfile: () => mockRefreshProfile(),
  };
  return { useAuth: () => value };
});
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({ useIsAppAdmin: () => ({ isAppAdmin: false }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('@cultuvilla/shared/services/mapsService', () => ({ staticMapUrl: jest.fn().mockReturnValue('https://maps.example.test/static') }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({
  getVillageViewLink: jest.fn().mockReturnValue('https://example.test'),
}));
const mockJoinVillage = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  joinVillage: (...a: unknown[]) => mockJoinVillage(...a),
}));
// JoinVillageModal's barrio picker fetches approved barrios; none here, so the
// picker hides itself and the modal shows only escudo + name + confirm.
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrios: jest.fn().mockResolvedValue([]),
  deletePlace: jest.fn(),
  deleteBarrio: jest.fn(),
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

const village = {
  id: 'm1',
  name: 'Anaya',
  province: 'Segovia',
  communityActive: true,
  community: { organizerId: null, description: null },
} as unknown as VillageHomeState['village'];

const base: VillageHomeState = {
  loading: false,
  loadError: null,
  village,
  villageAdmin: false,
  isMember: true,
  barrios: [],
  places: [],
  organizations: [],
  orgMemberCounts: {},
  events: [],
  news: [],
  festivalPosters: [],
  peopleCount: 3,
  pendingOrganizerRequest: false,
  myCensoAnswers: {},
};

beforeEach(() => {
  mockJoinVillage.mockClear();
  mockRefreshProfile.mockClear();
});

describe('VillageHomeBody', () => {
  it('hides the join CTA for a member', () => {
    const { queryByText } = render(<VillageHomeBody data={base} reload={jest.fn()} />);
    expect(queryByText('Unirme a este pueblo')).toBeNull();
  });

  it('shows the join CTA for a non-member and joins on confirm', async () => {
    const reload = jest.fn();
    const { getByText } = render(
      <VillageHomeBody data={{ ...base, isMember: false }} reload={reload} />,
    );
    // Press the CTA → the shared JoinVillageModal opens (escudo + name + confirm).
    fireEvent.press(getByText('Unirme a este pueblo'));
    // Confirm inside the modal → joins with the chosen barrio (null = whole village).
    fireEvent.press(await waitFor(() => getByText('Unirme')));
    // joinVillage both creates the membership and sets the active village so the
    // Pueblo tab surfaces it immediately (the bug this guards against).
    await waitFor(() =>
      expect(mockJoinVillage).toHaveBeenCalledWith('m1', 'u1', null),
    );
    expect(reload).toHaveBeenCalled();
    // Refresh the in-memory auth profile so the Pueblo tab picks up the new
    // activeMunicipalityId immediately, not only after an app restart.
    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
  });

  it('renders the start-village notice when the community is dormant', () => {
    const dormant = {
      ...base,
      village: { ...village, communityActive: false } as VillageHomeState['village'],
    };
    const { getByText } = render(<VillageHomeBody data={dormant} reload={jest.fn()} />);
    expect(getByText('Iniciar este pueblo')).toBeTruthy();
  });

  it('non-admin member sees "Compartir pueblo" as the second button', () => {
    const { getByText, queryByText } = render(<VillageHomeBody data={base} reload={jest.fn()} />);
    expect(getByText('Compartir pueblo')).toBeTruthy();
    expect(queryByText('Editar pueblo')).toBeNull();
  });

  it('no longer offers a separate invite action to members', () => {
    const { queryByText } = render(<VillageHomeBody data={base} reload={jest.fn()} />);
    expect(queryByText('Invitar vecino')).toBeNull();
  });

  it('admin sees "Editar pueblo" instead of "Compartir pueblo"', () => {
    const { getByText, queryByText } = render(
      <VillageHomeBody data={{ ...base, villageAdmin: true }} reload={jest.fn()} />,
    );
    expect(getByText('Editar pueblo')).toBeTruthy();
    expect(queryByText('Compartir pueblo')).toBeNull();
  });

  it('pressing "Editar pueblo" routes to the community settings screen', () => {
    const { getByText } = render(
      <VillageHomeBody data={{ ...base, villageAdmin: true }} reload={jest.fn()} />,
    );
    fireEvent.press(getByText('Editar pueblo'));
    expect(router.push).toHaveBeenCalledWith('/village/m1/community');
  });
});
