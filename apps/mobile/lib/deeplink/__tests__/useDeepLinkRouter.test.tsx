import { render, waitFor } from '@testing-library/react-native';

const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemove = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-linking', () => ({
  __esModule: true,
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (event: string, handler: (e: { url: string }) => void) => {
    mockAddEventListener(event, handler);
    return { remove: mockRemove };
  },
}));

jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import { useDeepLinkRouter } from '../useDeepLinkRouter';

function Probe(): null {
  useDeepLinkRouter();
  return null;
}

describe('useDeepLinkRouter', () => {
  beforeEach(() => {
    mockGetInitialURL.mockReset();
    mockAddEventListener.mockReset();
    mockRemove.mockReset();
    mockReplace.mockReset();
  });

  it('routes the initial URL when present (event)', async () => {
    mockGetInitialURL.mockResolvedValueOnce('https://example.test.app/event/evt_1');
    render(<Probe />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/event/evt_1'));
  });

  it('maps organization to /o/', async () => {
    mockGetInitialURL.mockResolvedValueOnce('https://example.test.app/o/org_1');
    render(<Probe />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/o/org_1'));
  });

  it('routes a runtime URL event', async () => {
    mockGetInitialURL.mockResolvedValueOnce(null);
    render(<Probe />);
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    const handler = mockAddEventListener.mock.calls[0][1] as (e: { url: string }) => void;
    handler({ url: 'https://example.test.app/village/mun_9' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/village/mun_9'));
  });

  it('ignores unknown URLs', async () => {
    mockGetInitialURL.mockResolvedValueOnce('https://example.test.app/unknown/x');
    render(<Probe />);
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    mockGetInitialURL.mockResolvedValueOnce(null);
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(mockAddEventListener).toHaveBeenCalled());
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
