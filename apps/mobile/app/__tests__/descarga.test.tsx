import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { I18nProvider } from '../../lib/i18n';
import Descarga from '../descarga';

// Force web platform + APP_AVAILABLE=false (the current pre-release state).
// Platform.OS is a plain mutable property on the RN module (see
// lib/__tests__/useWebPullToRefresh.test.tsx for the same pattern) — jest.mock
// of the Platform module doesn't work here because babel-preset-expo's jest
// preset bakes the platform into the babel transform, not the runtime module.
const originalOS = Platform.OS;
jest.mock('../../lib/appStores', () => ({
  APP_AVAILABLE: false,
  APP_STORES: { ios: '', android: '' },
  APP_SCHEME: 'cultuvilla',
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Redirect: () => null,
}));

describe('Descarga landing (web, pre-release)', () => {
  beforeEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = 'web';
  });

  afterEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = originalOS;
  });

  it('shows the open-in-web CTA and the coming-soon note, no store buttons', () => {
    render(
      <I18nProvider>
        <Descarga />
      </I18nProvider>,
    );
    expect(screen.getByText('Abrir en la web')).toBeTruthy();
    expect(screen.getByText('App para móvil, muy pronto.')).toBeTruthy();
    expect(screen.queryByText('Descargar en el App Store')).toBeNull();
  });
});
