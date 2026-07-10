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
    fireEvent.press(getByText('onboarding.completeProfile.sex_female')); // sex required
    fireEvent.press(getByText('common.stepper.next'));
    // Residence step now rendered — its birthday DateField is present.
    expect(getByTestId('birthday')).toBeTruthy();
  });

  /** Walk the stepper (identity → residence → about) so the biography field on
   * the last step is rendered. requireFullName defaults false, so identity only
   * needs a name + sex and residence has no required fields. */
  function reachAboutStep(props: Parameters<typeof PersonForm>[0]) {
    const utils = render(<PersonForm {...props} />);
    fireEvent.changeText(
      utils.getByLabelText('onboarding.completeProfile.givenName'),
      'Ana',
    );
    fireEvent.press(utils.getByText('onboarding.completeProfile.sex_female'));
    fireEvent.press(utils.getByText('common.stepper.next')); // → residence
    fireEvent.press(utils.getByText('common.stepper.next')); // → about
    return utils;
  }

  it('uses the first-person biography prompt on the owner’s own profile', () => {
    const { getByLabelText, queryByLabelText } = reachAboutStep({
      submitLabel: 'Guardar',
      selfProfile: true,
      onSubmit: jest.fn(),
    });
    expect(getByLabelText('onboarding.completeProfile.biographySelf')).toBeTruthy();
    expect(queryByLabelText('onboarding.completeProfile.biography')).toBeNull();
  });

  it('keeps the neutral biography label for a linked persona (default)', () => {
    const { getByLabelText, queryByLabelText } = reachAboutStep({
      submitLabel: 'Guardar',
      onSubmit: jest.fn(),
    });
    expect(getByLabelText('onboarding.completeProfile.biography')).toBeTruthy();
    expect(queryByLabelText('onboarding.completeProfile.biographySelf')).toBeNull();
  });

  describe('requireFirstSurname gate (linked-persona create)', () => {
    /** Fill the required birthday via the CalendarDatePicker: open the trigger,
     * jump to 1990-05 via the year/month picker (month is zero-based, so
     * May === 4), then press the day cell. */
    function fillBirthday(utils: ReturnType<typeof render>) {
      fireEvent.press(utils.getByTestId('birthday-trigger'));
      fireEvent.press(utils.getByTestId('birthday-calendar-title'));
      fireEvent.press(utils.getByTestId('birthday-calendar-year-1990'));
      fireEvent.press(utils.getByTestId('birthday-calendar-month-4'));
      fireEvent.press(utils.getByTestId('birthday-calendar-day-1990-05-05'));
    }

    it('blocks leaving the identity step until the first surname is filled', () => {
      const { getByText, getByLabelText, queryByTestId } = render(
        <PersonForm submitLabel="Guardar" requireFirstSurname onSubmit={jest.fn()} />,
      );
      fireEvent.changeText(getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
      fireEvent.press(getByText('onboarding.completeProfile.sex_female'));
      // Given name + sex are set but the first surname is still empty — Next is gated.
      fireEvent.press(getByText('common.stepper.next'));
      expect(queryByTestId('birthday')).toBeNull();
      // Filling the first surname unlocks the advance.
      fireEvent.changeText(getByLabelText('onboarding.completeProfile.firstSurname'), 'García');
      fireEvent.press(getByText('common.stepper.next'));
      expect(queryByTestId('birthday')).not.toBeNull();
    });

    it('blocks leaving the residence step until the birthday is filled', () => {
      const utils = render(
        <PersonForm submitLabel="Guardar" requireFirstSurname onSubmit={jest.fn()} />,
      );
      fireEvent.changeText(utils.getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
      fireEvent.changeText(utils.getByLabelText('onboarding.completeProfile.firstSurname'), 'García');
      fireEvent.press(utils.getByText('onboarding.completeProfile.sex_female'));
      fireEvent.press(utils.getByText('common.stepper.next')); // → residence
      // Birthday still empty — Next is gated; the about step's occupation picker isn't rendered.
      fireEvent.press(utils.getByText('common.stepper.next'));
      expect(utils.queryByTestId('occupation-otro')).toBeNull();
      fillBirthday(utils);
      fireEvent.press(utils.getByText('common.stepper.next'));
      expect(utils.getByTestId('occupation-otro')).toBeTruthy();
    });

    it('leaves the second surname optional (submits without it, with birthday set)', () => {
      const onSubmit = jest.fn();
      const utils = render(
        <PersonForm submitLabel="Guardar" requireFirstSurname onSubmit={onSubmit} />,
      );
      fireEvent.changeText(utils.getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
      fireEvent.changeText(utils.getByLabelText('onboarding.completeProfile.firstSurname'), 'García');
      fireEvent.press(utils.getByText('onboarding.completeProfile.sex_female'));
      fireEvent.press(utils.getByText('common.stepper.next')); // → residence
      fillBirthday(utils);
      fireEvent.press(utils.getByText('common.stepper.next')); // → about
      fireEvent.press(utils.getByText('Guardar'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          firstSurname: 'García',
          secondSurname: '',
          birthday: new Date(1990, 4, 5),
        }),
        null,
      );
    });
  });

  it('reveals the free-text occupation input only after selecting "Otro"', () => {
    const utils = reachAboutStep({ submitLabel: 'Guardar', onSubmit: jest.fn() });
    // Hidden until the user opts into a custom occupation.
    expect(utils.queryByTestId('occupation-custom-input')).toBeNull();
    fireEvent.press(utils.getByTestId('occupation-otro'));
    expect(utils.getByTestId('occupation-custom-input')).toBeTruthy();
    // Deselecting "Otro" hides it again.
    fireEvent.press(utils.getByTestId('occupation-otro'));
    expect(utils.queryByTestId('occupation-custom-input')).toBeNull();
  });

  it('persists typed custom occupations without the "otro" marker itself', () => {
    const onSubmit = jest.fn();
    const utils = reachAboutStep({ submitLabel: 'Guardar', onSubmit });
    fireEvent.press(utils.getByTestId('occupation-otro'));
    fireEvent.changeText(utils.getByTestId('occupation-custom-input'), 'malabarista');
    fireEvent.press(utils.getByTestId('occupation-custom-add'));
    fireEvent.press(utils.getByText('Guardar'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ occupations: ['malabarista'] }),
      null,
    );
  });
});
