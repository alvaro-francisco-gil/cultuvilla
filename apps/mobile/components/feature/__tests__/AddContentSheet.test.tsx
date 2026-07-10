import { render, fireEvent } from '@testing-library/react-native';
import { AddContentSheet } from '../AddContentSheet';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const baseProps = {
  visible: true,
  villageId: 'villa-1',
  canManage: false,
  onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('AddContentSheet', () => {
  // Regression: on web mobile there is no Escape key, no hardware back and no
  // swipe-to-dismiss, so the sheet MUST expose an explicit, labelled close
  // affordance. Backdrop-tap + the grab handle alone left users unable to close.
  it('exposes an explicit close button that dismisses the sheet', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(<AddContentSheet {...baseProps} onClose={onClose} />);
    fireEvent.press(getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
