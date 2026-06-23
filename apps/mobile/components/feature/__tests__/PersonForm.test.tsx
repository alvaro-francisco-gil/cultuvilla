// apps/mobile/components/feature/__tests__/PersonForm.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PersonForm } from '../PersonForm';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('<PersonForm> stepper', () => {
  it('shows the identity step first and blocks Next without a given name', () => {
    const onSubmit = jest.fn();
    const { getByText, getByLabelText, queryByTestId } = render(
      <PersonForm submitLabel="Guardar" onSubmit={onSubmit} />,
    );
    // Step indicator is icon-only, so detect the current step by its fields:
    // the identity step shows the given-name input; the residence step (which
    // owns the birthday DateField, testID "birthday") is not rendered yet.
    expect(getByLabelText('onboarding.completeProfile.givenName')).toBeTruthy();
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByTestId('birthday')).toBeNull();
  });

  it('advances once a given name is entered', () => {
    const { getByText, getByLabelText, getByTestId } = render(
      <PersonForm submitLabel="Guardar" onSubmit={jest.fn()} />,
    );
    fireEvent.changeText(getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
    fireEvent.press(getByText('common.stepper.next'));
    // Residence step now rendered — its birthday DateField is present.
    expect(getByTestId('birthday')).toBeTruthy();
  });
});
