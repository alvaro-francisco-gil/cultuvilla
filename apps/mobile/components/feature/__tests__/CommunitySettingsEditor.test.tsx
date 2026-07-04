import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CommunitySettingsEditor } from '../CommunitySettingsEditor';
import {
  getMunicipality,
  updateMunicipality,
  updateCommunity,
} from '@cultuvilla/shared/services/municipalityService';

// The community editor lives in the FIRST step of the community Stepper, which
// renders only the current step — so by the time the final "Listo" button fires,
// the editor is unmounted and a deferred imperative save() no-ops. These tests
// pin the fix: edits persist immediately, while the editor is mounted.

const mockVillage = {
  id: 'm1',
  name: 'Villa',
  province: 'X',
  comunidadAutonoma: 'X',
  codigoINE: '1',
  nameLower: 'villa',
  createdAt: new Date(),
  escudoUrl: null,
  escudoThumbUrl: null,
  escudoManualUrl: null,
  coordinates: null,
  mapZoom: null,
  communityActive: true,
  community: { description: 'hola', adminUserId: 'u1', profileForm: null, activatedAt: new Date() },
};

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn(),
  updateMunicipality: jest.fn(),
  updateCommunity: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadMunicipalityImage: jest.fn() }));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/dialogs', () => ({ showAlert: jest.fn() }));
jest.mock('../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));
// Stub the picker with a button that fires onChange with a fixed coordinate.
jest.mock('../LocationPicker', () => ({
  LocationPicker: ({ onChange }: { onChange: (c: { lat: number; lng: number }) => void }) => {
    const { Text, Pressable } = require('react-native');
    return (
      <Pressable accessibilityLabel="pick-loc" onPress={() => onChange({ lat: 40.4, lng: -3.7 })}>
        <Text>PICK</Text>
      </Pressable>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getMunicipality as jest.Mock).mockResolvedValue(mockVillage);
  (updateMunicipality as jest.Mock).mockResolvedValue(undefined);
  (updateCommunity as jest.Mock).mockResolvedValue(undefined);
});

describe('CommunitySettingsEditor location persistence', () => {
  it('persists a picked location immediately (not via an unmount-lost deferred save)', async () => {
    const { getByLabelText } = render(<CommunitySettingsEditor villageId="m1" />);
    const picker = await waitFor(() => getByLabelText('pick-loc'));

    fireEvent.press(picker);

    await waitFor(() => {
      expect(updateMunicipality).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ coordinates: { lat: 40.4, lng: -3.7 } }),
      );
    });
  });
});
