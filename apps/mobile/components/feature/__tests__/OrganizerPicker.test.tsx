import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OrganizerPicker } from '../OrganizerPicker';

// --- service mocks -----------------------------------------------------------
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMembers: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn(),
}));

import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';

const mockGetVillageMembers = getVillageMembers as jest.Mock;
const mockGetUserProfile = getUserProfile as jest.Mock;
const mockGetOrganizationsByMunicipality = getOrganizationsByMunicipality as jest.Mock;

// --- LiveOwnerChip mock — renders testID so we can find locked creator --------
jest.mock('../LiveOwnerChip', () => ({
  LiveOwnerChip: ({ ownerId, ownerType }: { ownerId: string; ownerType: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`chip-${ownerType}-${ownerId}`}>{ownerId}</Text>;
  },
}));

// --- i18n mock ----------------------------------------------------------------
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

// --- safe-area ----------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------

const MUNICIPALITY_ID = 'mun1';
const CREATOR_ID = 'creator1';
const OTHER_USER_ID = 'user2';
const ORG_ID = 'org1';

function defaultMocks() {
  mockGetVillageMembers.mockResolvedValue([
    { id: OTHER_USER_ID, userId: OTHER_USER_ID, role: 'user', joinedAt: new Date() },
    { id: CREATOR_ID, userId: CREATOR_ID, role: 'user', joinedAt: new Date() },
  ]);
  mockGetUserProfile.mockImplementation(async (uid: string) => ({
    displayName: uid === CREATOR_ID ? 'Creator Name' : 'Other User',
    photoURL: null,
  }));
  mockGetOrganizationsByMunicipality.mockResolvedValue([
    { id: ORG_ID, name: 'Org One', municipalityId: MUNICIPALITY_ID, status: 'approved' },
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
  defaultMocks();
});

describe('<OrganizerPicker>', () => {
  it('renders the locked creator chip immediately', async () => {
    const { getByTestId } = render(
      <OrganizerPicker
        municipalityId={MUNICIPALITY_ID}
        selectedUserIds={[CREATOR_ID]}
        selectedOrgIds={[]}
        lockedUserId={CREATOR_ID}
        onChangeUsers={jest.fn()}
        onChangeOrgs={jest.fn()}
      />,
    );
    // The locked creator chip is rendered regardless of async loading
    expect(getByTestId(`chip-user-${CREATOR_ID}`)).toBeTruthy();
  });

  it('calls onChangeOrgs when picking a group via the "Añadir grupo" sheet', async () => {
    const onChangeOrgs = jest.fn();
    const { getByTestId } = render(
      <OrganizerPicker
        municipalityId={MUNICIPALITY_ID}
        selectedUserIds={[CREATOR_ID]}
        selectedOrgIds={[]}
        lockedUserId={CREATOR_ID}
        onChangeUsers={jest.fn()}
        onChangeOrgs={onChangeOrgs}
      />,
    );
    // Open the group picker sheet
    await waitFor(() => {
      expect(getByTestId('add-org-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-org-btn'));
    // Wait for the sheet to show the org row, select it, then confirm
    await waitFor(() => {
      expect(getByTestId(`org-row-${ORG_ID}`)).toBeTruthy();
    });
    fireEvent.press(getByTestId(`org-row-${ORG_ID}`));
    fireEvent.press(getByTestId('org-confirm'));
    expect(onChangeOrgs).toHaveBeenCalledWith([ORG_ID]);
  });

  it('opens the villager sheet when add-user button is pressed and calls onChangeUsers on confirm', async () => {
    const onChangeUsers = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <OrganizerPicker
        municipalityId={MUNICIPALITY_ID}
        selectedUserIds={[CREATOR_ID]}
        selectedOrgIds={[]}
        lockedUserId={CREATOR_ID}
        onChangeUsers={onChangeUsers}
        onChangeOrgs={jest.fn()}
      />,
    );
    // Open the villager picker sheet
    await waitFor(() => {
      expect(getByTestId('add-user-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-user-btn'));
    // Wait for the sheet to show a villager row
    await waitFor(() => {
      expect(getByTestId(`villager-row-${OTHER_USER_ID}`)).toBeTruthy();
    });
    // Toggle the other user
    fireEvent.press(getByTestId(`villager-row-${OTHER_USER_ID}`));
    fireEvent.press(getByTestId('villager-confirm'));
    // Creator should remain, other user added
    expect(onChangeUsers).toHaveBeenCalledWith(expect.arrayContaining([CREATOR_ID, OTHER_USER_ID]));
  });

  it('does not allow the locked user to be deselected', async () => {
    const onChangeUsers = jest.fn();
    const { getByTestId } = render(
      <OrganizerPicker
        municipalityId={MUNICIPALITY_ID}
        selectedUserIds={[CREATOR_ID]}
        selectedOrgIds={[]}
        lockedUserId={CREATOR_ID}
        onChangeUsers={onChangeUsers}
        onChangeOrgs={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('add-user-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-user-btn'));
    await waitFor(() => {
      expect(getByTestId(`villager-row-${CREATOR_ID}`)).toBeTruthy();
    });
    // Pressing the locked user row should not remove it
    fireEvent.press(getByTestId(`villager-row-${CREATOR_ID}`));
    fireEvent.press(getByTestId('villager-confirm'));
    // Creator must still be in the selection
    const calls = onChangeUsers.mock.calls;
    if (calls.length > 0) {
      expect(calls[calls.length - 1][0]).toContain(CREATOR_ID);
    }
    // Also verify the locked chip still renders
    expect(getByTestId(`chip-user-${CREATOR_ID}`)).toBeTruthy();
  });
});
