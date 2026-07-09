import { render, fireEvent } from '@testing-library/react-native';
import { FloatingEditButton } from '../FloatingEditButton';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ t: (k: string) => k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FloatingEditButton', () => {
  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<FloatingEditButton onPress={onPress} />);
    fireEvent.press(getByLabelText('common.edit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
