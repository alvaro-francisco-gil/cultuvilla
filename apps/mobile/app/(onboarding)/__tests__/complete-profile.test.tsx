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
  uploadPersonImage: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipalities: jest.fn().mockResolvedValue([]),
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
        'onboarding.completeProfile.birthday': 'Fecha de nacimiento (opcional)',
        'onboarding.completeProfile.birthPlace': 'Lugar de nacimiento (opcional)',
        'onboarding.completeProfile.biography': 'Biografía (opcional)',
        'onboarding.completeProfile.submit': 'Crear perfil',
        'onboarding.completeProfile.requiredFields': 'El nombre y los dos apellidos son obligatorios.',
        'onboarding.completeProfile.error': 'No se pudo guardar el perfil',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('CompleteProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects submit when name or surnames are empty', async () => {
    const { getByText, findByText } = render(<CompleteProfileScreen />);
    await act(async () => {
      fireEvent.press(getByText('Crear perfil'));
    });
    expect(await findByText(/obligatorios/i)).toBeTruthy();
  });

  it('writes person first, then account, with derived displayName', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const personService = require('@cultuvilla/shared/services/personService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const userService = require('@cultuvilla/shared/services/userService');
    const order: string[] = [];
    (personService.createPerson as jest.Mock).mockImplementation(async () => { order.push('person'); return 'person-1'; });
    (userService.createUserProfile as jest.Mock).mockImplementation(async () => { order.push('user'); });

    const { getByLabelText, getByText } = render(<CompleteProfileScreen />);
    fireEvent.changeText(getByLabelText('Nombre'), 'Ana');
    fireEvent.changeText(getByLabelText('Primer apellido'), 'García');
    fireEvent.changeText(getByLabelText('Segundo apellido'), 'López');
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
        userId: 'uid-1',
        createdBy: 'uid-1',
      }),
    );
    expect(userService.createUserProfile).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ displayName: 'Ana García López', personId: 'person-1' }),
    );
  });
});
