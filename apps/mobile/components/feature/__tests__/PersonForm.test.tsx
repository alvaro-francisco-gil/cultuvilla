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
    const { getByText, queryByText } = render(
      <PersonForm submitLabel="Guardar" onSubmit={onSubmit} />,
    );
    // Identity step title is visible; about-step content is not yet.
    expect(getByText('profile.personForm.stepIdentity')).toBeTruthy();
    fireEvent.press(getByText('common.stepper.next'));
    // Still on step 1 — residence step title not shown.
    expect(queryByText('profile.personForm.stepResidence')).toBeNull();
  });

  it('advances once a given name is entered', () => {
    const { getByText, getByLabelText } = render(
      <PersonForm submitLabel="Guardar" onSubmit={jest.fn()} />,
    );
    fireEvent.changeText(getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('profile.personForm.stepResidence')).toBeTruthy();
  });
});
