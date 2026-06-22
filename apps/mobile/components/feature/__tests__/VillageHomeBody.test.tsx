import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { VillageHomeBody } from '../VillageHomeBody';
import type { VillageHomeState } from '../../../lib/useVillageHome';

jest.mock('../../../lib/auth/useAuth', () => {
  const value = { user: { uid: 'u1' }, profile: null, profileChecked: true };
  return { useAuth: () => value };
});
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({ useIsAppAdmin: () => ({ isAppAdmin: false }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({
  getVillageViewLink: jest.fn().mockReturnValue('https://example.test'),
  getVillageInviteLink: jest.fn().mockReturnValue('https://example.test'),
}));
const mockAddVillageMember = jest.fn(async () => undefined);
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  addVillageMember: (...a: unknown[]) => mockAddVillageMember(...a),
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
  community: { adminUserId: null, description: null, coverImages: [] },
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
  peopleCount: 3,
  pendingOrganizerRequest: false,
};

beforeEach(() => mockAddVillageMember.mockClear());

describe('VillageHomeBody', () => {
  it('hides the join CTA for a member', () => {
    const { queryByText } = render(<VillageHomeBody data={base} reload={jest.fn()} />);
    expect(queryByText('Unirme a este pueblo')).toBeNull();
  });

  it('shows the join CTA for a non-member and joins on confirm', async () => {
    // Native path: Alert.alert is used; auto-press the confirm button.
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, btns) => {
      btns?.find((x) => x.text !== 'Cancelar')?.onPress?.();
    });
    const reload = jest.fn();
    const { getByText } = render(
      <VillageHomeBody data={{ ...base, isMember: false }} reload={reload} />,
    );
    fireEvent.press(getByText('Unirme a este pueblo'));
    await waitFor(() => expect(mockAddVillageMember).toHaveBeenCalledWith('m1', 'u1'));
    expect(reload).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('renders the start-village notice when the community is dormant', () => {
    const dormant = {
      ...base,
      village: { ...village, communityActive: false } as VillageHomeState['village'],
    };
    const { getByText } = render(<VillageHomeBody data={dormant} reload={jest.fn()} />);
    expect(getByText('Iniciar este pueblo')).toBeTruthy();
  });
});
