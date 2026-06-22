import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import CompleteProfileScreen from '../complete-profile';

jest.mock('@cultuvilla/shared/services/personService', () => ({
  createPerson: jest.fn().mockResolvedValue('person-1'),
  updatePerson: jest.fn().mockResolvedValue(undefined),
  getPersonByUserId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  createUserProfile: jest.fn().mockResolvedValue(undefined),
  patchUserProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadUserPhoto: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipalities: jest.fn().mockResolvedValue([]),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1', email: 'a@b.test', displayName: null },
    profile: null,
    refreshProfile: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const map: Record<string, string> = {
        'onboarding.completeProfile.title': 'Completa tu perfil',
        'onboarding.completeProfile.accountSection': 'Tu cuenta',
        'onboarding.completeProfile.telephone': 'Teléfono (opcional)',
        'onboarding.completeProfile.village': 'Tu pueblo (opcional)',
        'onboarding.completeProfile.givenName': 'Nombre',
        'onboarding.completeProfile.firstSurname': 'Primer apellido',
        'onboarding.completeProfile.secondSurname': 'Segundo apellido',
        'onboarding.completeProfile.photo': 'Foto de perfil (opcional)',
        'onboarding.completeProfile.nickname': 'Apodo (opcional)',
        'onboarding.completeProfile.sex': 'Sexo (opcional)',
        'onboarding.completeProfile.sex_female': 'Mujer',
        'onboarding.completeProfile.sex_male': 'Hombre',
        'onboarding.completeProfile.sex_other': 'Otro',
        'onboarding.completeProfile.birthday': 'Fecha de nacimiento',
        'onboarding.completeProfile.birthPlace': 'Lugar de nacimiento (opcional)',
        'onboarding.completeProfile.biography': 'Biografía (opcional)',
        'onboarding.completeProfile.submit': 'Crear perfil',
        'onboarding.completeProfile.requiredFields': 'Nombre, ambos apellidos y fecha de nacimiento son obligatorios.',
        'onboarding.completeProfile.error': 'No se pudo guardar el perfil',
        'profile.personForm.stepIdentity': 'Identidad',
        'profile.personForm.stepResidence': 'Origen y residencia',
        'profile.personForm.stepAbout': 'Sobre ti',
        'profile.personForm.village': 'Tu pueblo (opcional)',
        'profile.personForm.barrio': 'Barrio (opcional)',
        'profile.personForm.wholeVillage': 'Todo el pueblo',
        'common.stepper.next': 'Siguiente',
        'common.stepper.back': 'Atrás',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('CompleteProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects submit when name or surnames are empty (stays on step 1)', async () => {
    const { getByText, queryByText } = render(<CompleteProfileScreen />);
    // On step 1, press Next without filling in any name.
    await act(async () => {
      fireEvent.press(getByText('Siguiente'));
    });
    // Still on the identity step — residence step is not shown.
    expect(queryByText('Origen y residencia')).toBeNull();
  });

  it('writes person first, then account; displayName is set by the Cloud Function trigger', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const personService = require('@cultuvilla/shared/services/personService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const userService = require('@cultuvilla/shared/services/userService');
    const order: string[] = [];
    (personService.createPerson as jest.Mock).mockImplementation(async () => { order.push('person'); return 'person-1'; });
    (userService.createUserProfile as jest.Mock).mockImplementation(async () => { order.push('user'); });

    const { getByText, getByLabelText, getByTestId, getAllByText } = render(<CompleteProfileScreen />);

    // Step 1: fill identity fields.
    fireEvent.changeText(getByLabelText('Nombre'), 'Ana');
    fireEvent.changeText(getByLabelText('Primer apellido'), 'García');
    fireEvent.changeText(getByLabelText('Segundo apellido'), 'López');
    fireEvent.press(getByText('Siguiente'));

    // Step 2: fill birthday (required when requireFullName=true).
    fireEvent.press(getByTestId('birthday-year'));
    fireEvent.press(getAllByText('1990')[0]!);
    fireEvent.press(getByTestId('birthday-month'));
    fireEvent.press(getAllByText('Mayo')[0]!);
    fireEvent.press(getByTestId('birthday-day'));
    const dayMatches = getAllByText('5');
    fireEvent.press(dayMatches[dayMatches.length - 1]!);
    fireEvent.press(getByText('Siguiente'));

    // Step 3: submit from the last step.
    await act(async () => {
      fireEvent.press(getByText('Crear perfil'));
    });

    await waitFor(() => {
      expect(order).toEqual(['person', 'user']);
    });
    expect(personService.createPerson).toHaveBeenCalledWith(
      expect.objectContaining({
        givenName: 'Ana',
        firstSurname: 'García',
        secondSurname: 'López',
        birthday: { year: 1990, month: 5, day: 5 },
        userId: 'uid-1',
        createdBy: 'uid-1',
      }),
    );
    expect(userService.createUserProfile).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ personId: 'person-1' }),
    );
    // Client must NOT send displayName — firestore.rules forbid it and the
    // trigger (functions/src/users/syncPersonDenormalization.ts) is the only writer.
    const userArgs = (userService.createUserProfile as jest.Mock).mock.calls[0][1];
    expect(userArgs).not.toHaveProperty('displayName');
  });
});
