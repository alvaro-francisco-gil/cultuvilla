import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockSetConsent = jest.fn();
jest.mock('@cultuvilla/shared', () => ({ observability: { setConsent: (...a: unknown[]) => mockSetConsent(...a) } }));
jest.mock('../../i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
  },
}));

import { ConsentBar } from '../ConsentBar';

describe('ConsentBar', () => {
  beforeEach(() => { mockSetConsent.mockReset(); for (const k of Object.keys(mockStore)) delete mockStore[k]; });

  it('shows when no choice stored and grants on accept', async () => {
    const { getByText } = render(<ConsentBar />);
    await waitFor(() => getByText('consent.accept'));
    fireEvent.press(getByText('consent.accept'));
    await waitFor(() => expect(mockSetConsent).toHaveBeenLastCalledWith({ analytics: true }));
  });
});
