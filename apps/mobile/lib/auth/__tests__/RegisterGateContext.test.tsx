import { existsSync } from 'fs';
import { join } from 'path';
import { act, render } from '@testing-library/react-native';
import { RegisterGateProvider, useRegisterGate } from '../RegisterGateContext';
import type { RegisterSheetProps } from '../../../components/feature/RegisterSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (href: string) => mockPush(href) },
}));

jest.mock('../useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../pendingIntent', () => ({
  readPendingIntent: jest.fn().mockResolvedValue(null),
  setPendingIntent: jest.fn().mockResolvedValue(undefined),
  clearPendingIntent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../pendingVillage', () => ({
  setPendingVillage: jest.fn().mockResolvedValue(undefined),
  clearPendingVillage: jest.fn().mockResolvedValue(undefined),
}));

let sheetProps: RegisterSheetProps | null = null;
jest.mock('../../../components/feature/RegisterSheet', () => ({
  RegisterSheet: (props: RegisterSheetProps) => {
    sheetProps = props;
    return null;
  },
}));

const APP_DIR = join(__dirname, '..', '..', '..', 'app');

function routeFileExists(href: string): boolean {
  const path = href.split('?')[0]!.replace(/^\//, '');
  return ['.tsx', '/index.tsx'].some((suffix) => existsSync(join(APP_DIR, `${path}${suffix}`)));
}

describe('RegisterGateProvider — register sheet lands on a real route (Unmatched route on sign-up)', () => {
  it('navigates to an existing sign-in screen when a guest taps register', async () => {
    let gate: ReturnType<typeof useRegisterGate> | null = null;
    function Consumer() {
      gate = useRegisterGate();
      return null;
    }
    render(
      <RegisterGateProvider>
        <Consumer />
      </RegisterGateProvider>,
    );

    act(() => {
      gate!.requireAuth('/(tabs)/perfil', 'reason');
    });
    act(() => {
      sheetProps!.onRegister();
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const href = mockPush.mock.calls[0]![0] as string;
    expect(routeFileExists(href)).toBe(true);
  });
});
