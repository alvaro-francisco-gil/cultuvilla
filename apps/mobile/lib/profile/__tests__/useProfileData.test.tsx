import { renderHook, waitFor } from '@testing-library/react-native';
import { useProfileData } from '../useProfileData';

// Regression: opening someone else's /user/[uid] profile rendered a blank
// card — no photo, no name, every stat empty. The hook asked for the viewed
// user's personas via getPersonsByCreator(theirUid), a query the persons read
// rule can never authorize for anyone but that user (see
// packages/shared/test/e2e/personRules.test.ts, "list by createdBy"). The
// permission-denied rejected the Promise.all that also carried the persona
// and event reads, so the whole load aborted before a single field was set.

const VIEWED = 'uid-2';
const PERSON = {
  id: 'p2',
  userId: VIEWED,
  createdBy: VIEWED,
  givenName: 'Lucía',
  firstSurname: 'Vecina',
  photoURL: 'https://photo.test/lucia.jpg',
};

jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn(),
  getPersonsByCreator: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByOrganizer: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getNewsPostsByOrganizer: jest.fn(),
  getApprovedNewsPostsByOrganizer: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

import {
  getPersonByUserId,
  getPersonsByCreator,
} from '@cultuvilla/shared/services/personService';
import { getEventsByOrganizer } from '@cultuvilla/shared/services/eventService';
import {
  getApprovedNewsPostsByOrganizer,
  getNewsPostsByOrganizer,
} from '@cultuvilla/shared/services/newsService';

const mockPersonByUserId = getPersonByUserId as jest.Mock;
const mockPersonsByCreator = getPersonsByCreator as jest.Mock;
const mockEventsByOrganizer = getEventsByOrganizer as jest.Mock;

function permissionDenied() {
  return Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPersonByUserId.mockResolvedValue(PERSON);
  mockPersonsByCreator.mockResolvedValue([]);
  mockEventsByOrganizer.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
  (getApprovedNewsPostsByOrganizer as jest.Mock).mockResolvedValue([]);
  (getNewsPostsByOrganizer as jest.Mock).mockResolvedValue([]);
});

describe('useProfileData — viewing another user', () => {
  it('never issues the personas query the rules deny for a stranger', async () => {
    const { result } = renderHook(() => useProfileData(VIEWED, 'muni-1', 'other'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    for (const call of mockPersonsByCreator.mock.calls) {
      // Either not called at all, or pinned to the caller's own uid.
      expect(call[1]).toBe(call[0]);
    }
  });

  it('reads the viewed persona through the public-only branch', async () => {
    const { result } = renderHook(() => useProfileData(VIEWED, 'muni-1', 'other'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockPersonByUserId).toHaveBeenCalledWith(VIEWED, null);
  });

  it('still fills the photo and the stats when the personas read is denied', async () => {
    mockPersonsByCreator.mockRejectedValue(permissionDenied());
    const { result } = renderHook(() => useProfileData(VIEWED, 'muni-1', 'other'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selfPerson).toEqual(PERSON);
    expect(result.current.eventsCreated).toBe(2);
    expect(result.current.allPersonas).toEqual([]);
  });
});

describe('useProfileData — viewing your own profile', () => {
  it('reads your own personas and persona unfiltered', async () => {
    mockPersonsByCreator.mockResolvedValue([PERSON]);
    const { result } = renderHook(() => useProfileData(VIEWED, 'muni-1', 'self'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockPersonByUserId).toHaveBeenCalledWith(VIEWED, VIEWED);
    expect(mockPersonsByCreator).toHaveBeenCalledWith(VIEWED, VIEWED);
    expect(result.current.allPersonas).toEqual([PERSON]);
  });
});
